import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { randomFillSync } from 'crypto';

const DEFAULT_DOMAIN = 'spermrace.io';
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function getSiwsDomains(): string[] {
  const raw = (process.env.SIWS_DOMAINS || DEFAULT_DOMAIN)
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  return raw.length > 0 ? raw : [DEFAULT_DOMAIN];
}

function getMessageField(lines: string[], prefix: string): string {
  const line = lines.find((entry) => entry.startsWith(prefix));
  return line?.replace(prefix, '').trim() || '';
}

export class AuthService {
  static createNonce(): string {
    const bytes = new Uint8Array(16);
    randomFillSync(bytes);
    return bs58.encode(bytes);
  }

  /**
   * Creates a SIWS-compliant message with domain, statement, nonce, issuedAt, and expiresAt
   */
  static getMessageToSign(nonce: string, domain?: string): string {
    const allowedDomains = getSiwsDomains();
    const signingDomain = (domain || allowedDomains[0] || DEFAULT_DOMAIN).trim().toLowerCase();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + MESSAGE_EXPIRY_MS).toISOString();

    return [
      `${signingDomain} wants you to sign in with your Solana account.`,
      '',
      'This signature proves you control this wallet and grants access to SpermRace tournaments.',
      '',
      `Domain: ${signingDomain}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
      `Expiration Time: ${expiresAt}`,
    ].join('\n');
  }

  /**
   * Verifies signature and validates message structure + expiration
   */
  static verifySignature(
    publicKeyStr: string,
    signatureStr: string,
    originalMessage: string,
    options?: { expectedNonce?: string; allowedDomains?: string[] }
  ): boolean {
    try {
      if (!publicKeyStr || !signatureStr || !originalMessage) return false;

      // 1. Verify cryptographic signature
      const messageBytes = new TextEncoder().encode(originalMessage);
      let signatureBytes: Uint8Array;
      try {
        signatureBytes = bs58.decode(signatureStr);
      } catch {
        signatureBytes = new Uint8Array(Buffer.from(signatureStr, 'base64'));
      }
      const publicKeyBytes = bs58.decode(publicKeyStr);
      const validSignature = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
      if (!validSignature) return false;

      // 2. Parse and validate message structure
      const lines = originalMessage.split('\n');
      const messageDomain = getMessageField(lines, 'Domain: ').toLowerCase();
      const nonce = getMessageField(lines, 'Nonce: ');
      const expirationTime = getMessageField(lines, 'Expiration Time: ');
      const allowedDomains = (options?.allowedDomains && options.allowedDomains.length > 0)
        ? options.allowedDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean)
        : getSiwsDomains();

      // 3. Validate domain matches
      if (!allowedDomains.includes(messageDomain)) {
        console.warn('[SIWS] Domain mismatch:', { expected: allowedDomains, got: messageDomain });
        return false;
      }

      // 4. Validate nonce binding when provided by caller
      if (options?.expectedNonce && nonce !== options.expectedNonce) {
        console.warn('[SIWS] Nonce mismatch:', { expected: options.expectedNonce, got: nonce });
        return false;
      }

      // 5. Validate not expired
      if (expirationTime) {
        const expiresAt = new Date(expirationTime);
        if (Date.now() > expiresAt.getTime()) {
          console.warn('[SIWS] Message expired:', { expiresAt });
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('[SIWS] Verification error:', err);
      return false;
    }
  }
}
