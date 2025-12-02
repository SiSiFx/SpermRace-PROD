import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { randomFillSync } from 'crypto';
const DOMAIN = 'spermrace.io'; // Production domain
const MESSAGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export class AuthService {
    static createNonce() {
        const bytes = new Uint8Array(16);
        randomFillSync(bytes);
        return bs58.encode(bytes);
    }
    /**
     * Creates a SIWS-compliant message with domain, statement, nonce, issuedAt, and expiresAt
     */
    static getMessageToSign(nonce) {
        const issuedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + MESSAGE_EXPIRY_MS).toISOString();
        return [
            `${DOMAIN} wants you to sign in with your Solana account.`,
            '',
            'This signature proves you control this wallet and grants access to SpermRace tournaments.',
            '',
            `Domain: ${DOMAIN}`,
            `Nonce: ${nonce}`,
            `Issued At: ${issuedAt}`,
            `Expiration Time: ${expiresAt}`,
        ].join('\n');
    }
    /**
     * Verifies signature and validates message structure + expiration
     */
    static verifySignature(publicKeyStr, signatureStr, originalMessage) {
        try {
            if (!publicKeyStr || !signatureStr || !originalMessage)
                return false;
            // 1. Verify cryptographic signature
            const messageBytes = new TextEncoder().encode(originalMessage);
            let signatureBytes;
            try {
                signatureBytes = bs58.decode(signatureStr);
            }
            catch {
                signatureBytes = new Uint8Array(Buffer.from(signatureStr, 'base64'));
            }
            const publicKeyBytes = bs58.decode(publicKeyStr);
            const validSignature = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
            if (!validSignature)
                return false;
            // 2. Parse and validate message structure
            const lines = originalMessage.split('\n');
            const domainLine = lines.find(l => l.startsWith('Domain: '));
            const expirationLine = lines.find(l => l.startsWith('Expiration Time: '));
            // 3. Validate domain matches
            const messageDomain = domainLine?.replace('Domain: ', '').trim();
            if (messageDomain !== DOMAIN) {
                console.warn('[SIWS] Domain mismatch:', { expected: DOMAIN, got: messageDomain });
                return false;
            }
            // 4. Validate not expired
            const expirationTime = expirationLine?.replace('Expiration Time: ', '').trim();
            if (expirationTime) {
                const expiresAt = new Date(expirationTime);
                if (Date.now() > expiresAt.getTime()) {
                    console.warn('[SIWS] Message expired:', { expiresAt });
                    return false;
                }
            }
            return true;
        }
        catch (err) {
            console.error('[SIWS] Verification error:', err);
            return false;
        }
    }
}
