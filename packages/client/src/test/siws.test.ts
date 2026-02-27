import { describe, it, expect, vi } from 'vitest';

vi.mock('../walletUtils', () => ({
  signSIWSMessage: vi.fn(() => Promise.resolve('signed-message')),
}));

import { handleSIWS } from '../siws';
import { signSIWSMessage } from '../walletUtils';

describe('handleSIWS', () => {
  it('returns signed SIWS payload with given public key and nonce', async () => {
    const provider = { name: 'mock' } as any;
    const result = await handleSIWS(provider, { message: 'msg', nonce: 'n1' }, 'pubkey123');
    expect(signSIWSMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ publicKey: 'pubkey123', signedMessage: 'signed-message', nonce: 'n1' });
  });
});
