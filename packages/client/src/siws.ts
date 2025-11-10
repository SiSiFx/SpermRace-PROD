import type { WalletAdapter } from '@solana/wallet-adapter-base';
import { signSIWSMessage } from './walletUtils';

export interface SIWSChallenge { message: string; nonce: string }

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('SIWS_TIMEOUT')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }).catch(e => { clearTimeout(t); reject(e); });
  });
}

export async function handleSIWS(provider: WalletAdapter, challenge: SIWSChallenge, publicKey: string) {
  console.log('[SIWS] handleSIWS invoked → requesting wallet signature');
  // Allow more time for wallet UI to appear and user to approve (60s for mobile)
  const sig = await withTimeout(signSIWSMessage(provider, challenge.message), 60000);
  return { publicKey, signedMessage: sig, nonce: challenge.nonce };
}




















