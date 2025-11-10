import React, { useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import type { WalletAdapter, WalletError } from '@solana/wallet-adapter-base';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';
import './wallet-adapter-fixes.css';

// Get RPC endpoint from environment or use defaults
const getRpcEndpoint = (): string => {
  const env = (import.meta as any).env?.VITE_SOLANA_RPC_ENDPOINT as string | undefined;
  if (env && typeof env === 'string' && env.trim()) return env.trim();

  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    if (host.includes('dev.spermrace.io')) return 'https://api.devnet.solana.com';
    if (host.includes('spermrace.io')) return 'https://api.mainnet-beta.solana.com';
  } catch {}

  return 'https://api.devnet.solana.com';
};

// Get cluster type for display
export const getClusterType = (): 'devnet' | 'mainnet-beta' => {
  const env = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  if (env && /^(devnet|mainnet)$/i.test(env)) {
    return env.toLowerCase() === 'mainnet' ? 'mainnet-beta' : 'devnet';
  }

  try {
    const host = (window?.location?.hostname || '').toLowerCase();
    return host.includes('dev.spermrace.io') ? 'devnet' : 'mainnet-beta';
  } catch {}

  return 'devnet';
};

interface Props {
  children: React.ReactNode;
}

/**
 * Modern Solana Wallet Provider with full mobile support
 * Supports Phantom, Solflare, Coinbase, Trust Wallet, and mobile wallets
 */
export const WalletProviderNew: FC<Props> = ({ children }) => {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  // Detect if we're on mobile
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  // Configure wallets
  const wallets = useMemo(() => {
    const adapters: WalletAdapter[] = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TrustWalletAdapter(),
    ];

    // WalletConnect (QR / mobile deep link) for mobile and desktop
    try {
      const projectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
      if (projectId && typeof projectId === 'string' && projectId.trim()) {
        const cluster = getClusterType(); // 'devnet' | 'mainnet-beta'
        const wcNetwork = cluster === 'mainnet-beta' ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;
        adapters.push(
          new WalletConnectWalletAdapter({
            network: wcNetwork,
            options: {
              projectId: projectId.trim(),
              relayUrl: 'wss://relay.walletconnect.com',
              metadata: {
                name: 'SpermRace.io',
                description: 'SpermRace.io — Multiplayer Solana Game',
                url: (typeof window !== 'undefined' ? window.location.origin : 'https://spermrace.io'),
                icons: [(typeof window !== 'undefined' ? new URL('/logo.png', window.location.origin).toString() : 'https://spermrace.io/logo.png')],
              },
            },
          }) as unknown as WalletAdapter
        );
      }
    } catch (e) {
      console.warn('[WALLET] WalletConnect adapter init failed', e);
    }

    // Add mobile wallet adapter for mobile devices
    if (isMobile) {
      adapters.push(
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity: {
            name: 'SpermRace.io',
            uri: window.location.origin,
            icon: '/logo.png',
          },
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          cluster: getClusterType(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        })
      );
    }

    return adapters;
  }, [isMobile]);

  // Error handler
  const onError = useCallback((error: WalletError) => {
    console.error('[WALLET ERROR]', error);

    // User-friendly error messages
    let userMessage = error.message;

    if (error.message.includes('User rejected')) {
      userMessage = 'Wallet connection was rejected. Please try again.';
    } else if (error.message.includes('not found')) {
      userMessage = 'No wallet found. Please install a Solana wallet like Phantom or Solflare.';
    } else if (error.message.includes('timeout')) {
      userMessage = 'Connection timeout. Please try again.';
    }

    // Show error toast (can be customized)
    if (typeof window !== 'undefined') {
      try {
        // Dispatch custom event that can be caught by app
        window.dispatchEvent(new CustomEvent('wallet-error', { detail: { error, userMessage } }));
      } catch {}
    }
  }, []);

  // Auto-connect configuration (disable on mobile to avoid WalletConnect races)
  const autoConnect = useMemo(() => {
    try {
      const disableAutoConnect = localStorage.getItem('sr_disable_autoconnect');
      if (isMobile) return false;
      return disableAutoConnect !== '1';
    } catch {
      return !isMobile;
    }
  }, [isMobile]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider
        wallets={wallets}
        onError={onError}
        autoConnect={autoConnect}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProviderNew;

