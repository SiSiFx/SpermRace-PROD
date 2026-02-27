import { EntryFeeTier } from 'shared';
import { appendPaymentAudit, loadPaymentState, schedulePaymentStateAutosave, type PaymentStateSnapshot } from './paymentPersistence.js';

const paymentStatePath = process.env.PAYMENT_STATE_PATH || './packages/server/data/payment-state.json';
const paymentAuditPath = process.env.PAYMENT_AUDIT_LOG_PATH || './packages/server/data/payment-audit.log';

const paidPlayers = new Set<string>();
const expectedLamportsByPlayerId = new Map<string, number>();
const expectedTierByPlayerId = new Map<string, EntryFeeTier>();
const pendingPaymentByPlayerId = new Map<string, { paymentId: string; createdAt: number; lamports: number; tier: EntryFeeTier }>();
const usedPaymentIds = new Set<string>();

export function initPayments(log: { info?: (...args: any[]) => void; debug?: (...args: any[]) => void }) {
  const persisted: PaymentStateSnapshot = loadPaymentState(paymentStatePath);
  persisted.paidPlayers.forEach(p => paidPlayers.add(p));
  Object.entries(persisted.expectedLamportsByPlayerId).forEach(([k, v]) => expectedLamportsByPlayerId.set(k, v));
  Object.entries(persisted.expectedTierByPlayerId).forEach(([k, v]) => expectedTierByPlayerId.set(k, v as EntryFeeTier));
  Object.entries(persisted.pendingPaymentByPlayerId).forEach(([k, v]) => pendingPaymentByPlayerId.set(k, v as any));
  persisted.usedPaymentIds.forEach(p => usedPaymentIds.add(p));
  log.info?.(`[PAYMENT] Restored state from ${paymentStatePath} (paid=${paidPlayers.size}, pending=${pendingPaymentByPlayerId.size})`);
  schedulePaymentStateAutosave({
    filePath: paymentStatePath,
    intervalMs: 10000,
    getState: () => ({
      paidPlayers: Array.from(paidPlayers),
      expectedLamportsByPlayerId: Object.fromEntries(expectedLamportsByPlayerId.entries()),
      expectedTierByPlayerId: Object.fromEntries(expectedTierByPlayerId.entries()),
      pendingPaymentByPlayerId: Object.fromEntries(pendingPaymentByPlayerId.entries()),
      usedPaymentIds: Array.from(usedPaymentIds),
    }),
    log,
  });
}

export {
  paidPlayers,
  expectedLamportsByPlayerId,
  expectedTierByPlayerId,
  pendingPaymentByPlayerId,
  usedPaymentIds,
  paymentAuditPath,
};

export function audit(event: Record<string, any>) {
  appendPaymentAudit(paymentAuditPath, event);
}
