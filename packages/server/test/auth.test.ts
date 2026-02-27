import { describe, it, expect, vi, beforeEach } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

async function loadAuth(domains: string[]) {
  vi.resetModules();
  process.env.SIWS_DOMAINS = domains.join(',');
  const mod = await import('../src/AuthService.js');
  return mod.AuthService;
}

const encode = (msg: string) => new TextEncoder().encode(msg);

describe('AuthService SIWS domains', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('accepts signatures for spermrace.io', async () => {
    const AuthService = await loadAuth(['spermrace.io']);
    const nonce = 'test-nonce';
    const msg = AuthService.getMessageToSign(nonce);
    const kp = nacl.sign.keyPair();
    const sig = nacl.sign.detached(encode(msg), kp.secretKey);
    const ok = AuthService.verifySignature(bs58.encode(kp.publicKey), bs58.encode(sig), msg);
    expect(ok).toBe(true);
  });

  it('rejects signatures with mismatched domain', async () => {
    const AuthService = await loadAuth(['spermrace.io']);
    const nonce = 'test-nonce-2';
    const msg = AuthService.getMessageToSign(nonce).replace('Domain: spermrace.io', 'Domain: evil.com');
    const kp = nacl.sign.keyPair();
    const sig = nacl.sign.detached(encode(msg), kp.secretKey);
    const ok = AuthService.verifySignature(bs58.encode(kp.publicKey), bs58.encode(sig), msg);
    expect(ok).toBe(false);
  });
});
