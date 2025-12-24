import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadPaymentState, savePaymentState, type PaymentStateSnapshot } from '../src/paymentPersistence.js';

const TMP = path.join(process.cwd(), 'data', `payment-state-test-${Date.now()}.json`);

afterEach(() => {
  try { fs.rmSync(path.dirname(TMP), { recursive: true, force: true }); } catch {}
});

describe('paymentPersistence', () => {
  it('saves and loads snapshot', () => {
    const snapshot: PaymentStateSnapshot = {
      paidPlayers: ['A', 'B'],
      expectedLamportsByPlayerId: { A: 10 },
      expectedTierByPlayerId: { A: 5 as any },
      pendingPaymentByPlayerId: { A: { paymentId: 'p1', createdAt: 1, lamports: 10, tier: 5 as any } },
      usedPaymentIds: ['p1'],
    };
    savePaymentState(TMP, snapshot);
    const loaded = loadPaymentState(TMP);
    expect(loaded.paidPlayers).toEqual(snapshot.paidPlayers);
    expect(loaded.expectedLamportsByPlayerId).toEqual(snapshot.expectedLamportsByPlayerId);
    expect(loaded.pendingPaymentByPlayerId).toEqual(snapshot.pendingPaymentByPlayerId);
  });
});
