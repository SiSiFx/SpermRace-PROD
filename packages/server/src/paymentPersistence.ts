import fs from 'fs';
import path from 'path';
import { EntryFeeTier } from 'shared';

export type PaymentStateSnapshot = {
  paidPlayers: string[];
  expectedLamportsByPlayerId: Record<string, number>;
  expectedTierByPlayerId: Record<string, EntryFeeTier>;
  pendingPaymentByPlayerId: Record<string, { paymentId: string; createdAt: number; lamports: number; tier: EntryFeeTier }>;
  usedPaymentIds: string[];
};

const EMPTY_STATE: PaymentStateSnapshot = {
  paidPlayers: [],
  expectedLamportsByPlayerId: {},
  expectedTierByPlayerId: {},
  pendingPaymentByPlayerId: {},
  usedPaymentIds: [],
};

function ensureDir(filePath: string) {
  try { fs.mkdirSync(path.dirname(filePath), { recursive: true }); } catch {}
}

export function loadPaymentState(filePath: string): PaymentStateSnapshot {
  try {
    if (!fs.existsSync(filePath)) return { ...EMPTY_STATE };
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      paidPlayers: Array.isArray(parsed?.paidPlayers) ? parsed.paidPlayers : [],
      expectedLamportsByPlayerId: parsed?.expectedLamportsByPlayerId || {},
      expectedTierByPlayerId: parsed?.expectedTierByPlayerId || {},
      pendingPaymentByPlayerId: parsed?.pendingPaymentByPlayerId || {},
      usedPaymentIds: Array.isArray(parsed?.usedPaymentIds) ? parsed.usedPaymentIds : [],
    } as PaymentStateSnapshot;
  } catch (e) {
    console.error('[PAYMENT] Failed to load payment state:', e);
    return { ...EMPTY_STATE };
  }
}

export function savePaymentState(filePath: string, snapshot: PaymentStateSnapshot) {
  try {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (e) {
    console.error('[PAYMENT] Failed to save payment state:', e);
  }
}

type MinimalLogger = { info?: (...args: any[]) => void; warn?: (...args: any[]) => void; error?: (...args: any[]) => void; debug?: (...args: any[]) => void };

export function schedulePaymentStateAutosave(opts: { filePath: string; intervalMs?: number; getState: () => PaymentStateSnapshot; log?: MinimalLogger }) {
  const { filePath, intervalMs = 10000, getState, log = console } = opts;
  const flush = () => savePaymentState(filePath, getState());
  flush();
  const handle = setInterval(flush, intervalMs);
  const exitHandler = () => {
    try { flush(); } catch {}
    try { clearInterval(handle); } catch {}
  };
  process.on('exit', exitHandler);
  process.on('SIGINT', () => { exitHandler(); process.exit(0); });
  process.on('SIGTERM', () => { exitHandler(); process.exit(0); });
  (log.info || log.debug || console.info).call(log, `[PAYMENT] Autosave enabled → ${filePath} every ${intervalMs}ms`);
  return handle;
}

export function appendPaymentAudit(filePath: string, entry: Record<string, any>) {
  try {
    ensureDir(filePath);
    const line = JSON.stringify({ ts: Date.now(), ...entry });
    fs.appendFileSync(filePath, line + '\n');
  } catch (e) {
    console.error('[PAYMENT] Failed to append audit log:', e);
  }
}
