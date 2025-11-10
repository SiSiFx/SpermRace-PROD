import type { WalletAdapter } from '@solana/wallet-adapter-base';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Modern wallet utilities with proper error handling
 */

type MessageSignerAdapter = WalletAdapter & {
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

type TransactionSignerAdapter = WalletAdapter & {
  signTransaction: (
    transaction: Transaction | VersionedTransaction
  ) => Promise<Transaction | VersionedTransaction>;
};

function isMessageSigner(adapter: WalletAdapter): adapter is MessageSignerAdapter {
  return typeof (adapter as MessageSignerAdapter).signMessage === 'function';
}

function canSignTransaction(adapter: WalletAdapter): adapter is TransactionSignerAdapter {
  return typeof (adapter as TransactionSignerAdapter).signTransaction === 'function';
}

/**
 * Sign a message for SIWS (Sign-In With Solana) authentication
 */
export async function signSIWSMessage(
  adapter: WalletAdapter,
  message: string
): Promise<string> {
  if (!adapter.publicKey) {
    throw new Error('Wallet not connected');
  }

  if (!isMessageSigner(adapter)) {
    throw new Error('Wallet does not support message signing');
  }

  try {
    console.log('[SIWS] Signing message with adapter', adapter.name);
    const encoded = new TextEncoder().encode(message);
    const signature = await adapter.signMessage(encoded);
    return bs58.encode(signature);
  } catch (error: any) {
    console.error('[SIWS] Signature failed:', error);

    // Handle common errors
    if (error.message?.includes('User rejected')) {
      throw new Error('Signature request was rejected');
    }

    throw new Error(error.message || 'Failed to sign message');
  }
}

/**
 * Sign and send a transaction (for entry fees, etc.)
 */
export async function sendTransaction(
  adapter: WalletAdapter,
  transaction: Transaction | VersionedTransaction,
  connection: Connection,
  options?: {
    skipPreflight?: boolean;
    preflightCommitment?: 'processed' | 'confirmed' | 'finalized';
  }
): Promise<string> {
  if (!adapter.publicKey) {
    throw new Error('Wallet not connected');
  }

  try {
    console.log('[TX] Sending transaction via adapter', adapter.name);
    let signature: string;

    // Use adapter's sendTransaction if available (preferred)
    if (typeof adapter.sendTransaction === 'function') {
      signature = await adapter.sendTransaction(transaction as any, connection, {
        skipPreflight: options?.skipPreflight ?? false,
        preflightCommitment: options?.preflightCommitment ?? 'confirmed',
      });
    } else {
      // Fallback: sign then send manually
      if (!canSignTransaction(adapter)) {
        throw new Error('Wallet does not support transaction signing');
      }

      const signed = await adapter.signTransaction(transaction);
      const rawTransaction = signed.serialize();
      signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: options?.skipPreflight ?? false,
        preflightCommitment: options?.preflightCommitment ?? 'confirmed',
      });
    }

    console.log('[TX] Transaction sent:', signature.slice(0, 12) + '...');
    return signature;
  } catch (error: any) {
    console.error('[TX] Transaction failed:', error);

    // Handle common errors
    if (error.message?.includes('User rejected')) {
      throw new Error('Transaction was rejected');
    } else if (error.message?.includes('Insufficient funds')) {
      throw new Error('Insufficient SOL balance');
    } else if (error.message?.includes('Blockhash not found')) {
      throw new Error('Transaction expired. Please try again.');
    }

    throw new Error(error.message || 'Transaction failed');
  }
}

/**
 * Send an entry fee transaction from base64-encoded transaction
 */
export async function sendEntryFeeTransaction(
  adapter: WalletAdapter,
  txBase64: string,
  rpcEndpoint: string
): Promise<string> {
  if (!adapter.publicKey) {
    throw new Error('Wallet not connected');
  }

  try {
    console.log('[ENTRY FEE] Preparing entry fee transaction');
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // Deserialize transaction
    const txBytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(txBytes);

    // Sign and send
    return await sendTransaction(adapter, transaction, connection, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
  } catch (error: any) {
    console.error('[ENTRY FEE] Failed:', error);
    throw error;
  }
}

/**
 * Format wallet address for display
 */
export function formatAddress(address: string, length = 4): string {
  if (!address) return '';
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Check if on mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Get wallet deep link for mobile
 */
export function getWalletDeepLink(walletName: string): string | null {
  const origin = window.location.origin;
  const callback = encodeURIComponent(`${origin}/wallet-callback`);

  const deepLinks: Record<string, string> = {
    phantom: `https://phantom.app/ul/browse/${origin}?ref=${callback}`,
    solflare: `https://solflare.com/ul/v1/browse/${origin}?ref=${callback}`,
    backpack: `https://backpack.app/ul/browse/${origin}?ref=${callback}`,
  };

  return deepLinks[walletName.toLowerCase()] || null;
}

/**
 * Request wallet connection with fallback to deep link on mobile
 */
export async function requestWalletConnection(
  adapter: WalletAdapter
): Promise<void> {
  try {
    if (adapter.connected) {
      console.log('[WALLET] Already connected');
      return;
    }

    await adapter.connect();
    console.log('[WALLET] Connected successfully');
  } catch (error: any) {
    console.error('[WALLET] Connection failed:', error);

    // On mobile, try to open wallet app
    if (isMobileDevice() && error.message?.includes('not found')) {
      const deepLink = getWalletDeepLink(adapter.name);
      if (deepLink) {
        console.log('[WALLET] Opening mobile wallet app...');
        window.location.href = deepLink;
      }
    }

    throw error;
  }
}

/**
 * Disconnect wallet and clear auto-connect flag
 */
export async function disconnectWallet(adapter: WalletAdapter): Promise<void> {
  try {
    await adapter.disconnect();
    // Set flag to prevent auto-connect
    try {
      localStorage.setItem('sr_disable_autoconnect', '1');
    } catch {}
    console.log('[WALLET] Disconnected');
  } catch (error) {
    console.error('[WALLET] Disconnect failed:', error);
  }
}

/**
 * Clear disconnect flag to allow auto-connect
 */
export function enableAutoConnect(): void {
  try {
    localStorage.removeItem('sr_disable_autoconnect');
  } catch {}
}

