import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { WalletAdapter } from '@solana/wallet-adapter-base';
import { useWallet as useAdapterWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import WalletProviderNew from './WalletProviderNew';

type WalletState = {
  publicKey: string | null;
  name: string | null;
  provider: WalletAdapter | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  isConnecting: boolean;
  getLatest: () => { publicKey: string | null; provider: WalletAdapter | null; name: string | null };
};

type PendingConnect = {
  resolve: (success: boolean) => void;
  timeoutId: number | null;
  showModal: boolean;
};

const defaultState: WalletState = {
  publicKey: null,
  name: null,
  provider: null,
  connect: async () => false,
  disconnect: async () => {},
  isConnecting: false,
  getLatest: () => ({ publicKey: null, provider: null, name: null }),
};

const Ctx = createContext<WalletState>(defaultState);

function isMobileUA(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function WalletContextBridge({ children }: { children: React.ReactNode }) {
  const { publicKey, wallet, wallets, select, connect, disconnect, connecting } = useAdapterWallet();
  const { visible, setVisible } = useWalletModal();
  const [name, setName] = useState<string | null>(wallet?.adapter?.name ?? null);
  const [provider, setProvider] = useState<WalletAdapter | null>(wallet?.adapter ?? null);
  const pendingRef = useRef<PendingConnect | null>(null);
  const latestRef = useRef<{ publicKey: string | null; provider: WalletAdapter | null; name: string | null }>({ publicKey: null, provider: null, name: null });

  useEffect(() => {
    const adapter = wallet?.adapter ?? null;
    if (adapter) {
      const adapterName = String(adapter.name);
      console.log('[WALLET] Adapter detected →', adapterName);
      setName(adapterName);
      setProvider(adapter);
    } else {
      console.log('[WALLET] Adapter cleared');
      setName(null);
      setProvider(null);
    }
  }, [wallet]);

  const resolvePending = useCallback(
    (value: boolean) => {
      const pending = pendingRef.current;
      if (!pending) return;
      if (pending.timeoutId != null) {
        window.clearTimeout(pending.timeoutId);
      }
      pendingRef.current = null;
      if (pending.showModal) {
        setVisible(false);
      }
      try {
        pending.resolve(value);
      } catch (err) {
        console.warn('[WALLET] Failed to resolve pending connect promise', err);
      }
    },
    [setVisible]
  );

  const waitForConnectionResult = useCallback(
    (showModal: boolean, timeoutMs: number) => {
      resolvePending(false);
      const canUseWindow = typeof window !== 'undefined';
      if (showModal && canUseWindow) setVisible(true);
      if (!canUseWindow) {
        return Promise.resolve(false);
      }
      return new Promise<boolean>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          if (pendingRef.current && pendingRef.current.resolve === resolve) {
            pendingRef.current = null;
            if (showModal) setVisible(false);
            resolve(false);
          }
        }, timeoutMs);
        pendingRef.current = { resolve, timeoutId, showModal };
      });
    },
    [resolvePending, setVisible]
  );

  useEffect(() => {
    if (publicKey) {
      resolvePending(true);
      try {
        localStorage.removeItem('sr_disable_autoconnect');
      } catch {}
      if (wallet?.adapter?.name) {
        try {
          localStorage.setItem('sr_last_wallet', String(wallet.adapter.name));
        } catch {}
      }
    }
  }, [publicKey, resolvePending, wallet]);

  useEffect(() => {
    if (!visible && pendingRef.current?.showModal) {
      if (publicKey) {
        resolvePending(true);
        return;
      }
      if (!connecting && !wallet) {
        resolvePending(false);
      }
    }
  }, [visible, publicKey, connecting, wallet, resolvePending]);

  const connectThroughAdapter = useCallback(async () => {
    console.log('[WALLET] connectThroughAdapter() invoked');
    const waitPromise = waitForConnectionResult(false, 20000);
    try {
      await connect();
      console.log('[WALLET] connect() promise resolved');
    } catch (err) {
      console.error('[WALLET] connect() failed', err);
      resolvePending(false);
      return false;
    }
    return waitPromise;
  }, [connect, waitForConnectionResult, resolvePending]);

  const connectWrapper = useCallback(async () => {
    console.log('[WALLET] connectWrapper() start');
    if (typeof window === 'undefined') return false;
    if (publicKey) return true;

    if (wallet) {
      console.log('[WALLET] Wallet already selected → using existing adapter');
      return await connectThroughAdapter();
    }

    // On mobile, always show the wallet selection modal (avoid stale desktop preference)
    if (isMobileUA()) {
      const result = await waitForConnectionResult(true, 60000);
      console.log('[WALLET] Modal result (mobile) →', result);
      return result;
    }

    // Desktop: try auto-selecting last used wallet, else show modal
    try {
      const preferred = localStorage.getItem('sr_last_wallet');
      if (preferred) {
        const candidate = wallets.find((w) => String(w.adapter.name) === preferred);
        if (candidate) {
          console.log('[WALLET] Auto-selecting last wallet →', preferred);
          await select(candidate.adapter.name);
          await new Promise((resolve) => setTimeout(resolve, 0));
          return await connectThroughAdapter();
        }
        console.log('[WALLET] Stored wallet not available → showing modal');
      }
    } catch (err) {
      console.warn('[WALLET] Failed to auto-select last wallet', err);
    }

    const result = await waitForConnectionResult(true, 60000);
    console.log('[WALLET] Modal result →', result);
    return result;
  }, [publicKey, wallet, connectThroughAdapter, wallets, select, waitForConnectionResult]);

  const disconnectWrapper = useCallback(async () => {
    resolvePending(false);
    try {
      await disconnect();
    } catch (err) {
      console.warn('[WALLET] disconnect() warning', err);
    } finally {
      try {
        localStorage.setItem('sr_disable_autoconnect', '1');
      } catch {}
    }
  }, [disconnect, resolvePending]);

  const publicKeyString = useMemo(() => {
    if (!publicKey) return null;
    try {
      if (typeof publicKey === 'string') return publicKey;
      if (typeof (publicKey as any).toBase58 === 'function') return (publicKey as any).toBase58();
      if (typeof (publicKey as any).toString === 'function') return (publicKey as any).toString();
    } catch (err) {
      console.warn('[WALLET] Failed to stringify public key', err);
    }
    return null;
  }, [publicKey]);

  useEffect(() => {
    latestRef.current = { publicKey: publicKeyString, provider, name };
    if (publicKeyString && provider) {
      console.log('[WALLET] Latest updated →', publicKeyString.slice(0, 4), provider.name);
    }
  }, [publicKeyString, provider, name]);

  const getLatest = useCallback(() => latestRef.current, []);

  const value = useMemo<WalletState>(() => ({
    publicKey: publicKeyString,
    name,
    provider,
    connect: connectWrapper,
    disconnect: disconnectWrapper,
    isConnecting: connecting,
    getLatest,
  }), [publicKeyString, name, provider, connectWrapper, disconnectWrapper, connecting, getLatest]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WalletProviderNew>
      <WalletContextBridge>{children}</WalletContextBridge>
    </WalletProviderNew>
  );
}

export function useWallet() {
  return useContext(Ctx);
}

