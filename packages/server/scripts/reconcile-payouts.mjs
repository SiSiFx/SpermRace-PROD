import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const args = {
    auditDir: process.env.AUDIT_DIR || path.resolve('./data/audit'),
    from: process.env.FROM || null, // YYYY-MM-DD
    to: process.env.TO || null,     // YYYY-MM-DD
    failOnly: (process.env.FAIL_ONLY || '0') === '1',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--auditDir') args.auditDir = argv[++i];
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--to') args.to = argv[++i];
    else if (a === '--failOnly') args.failOnly = true;
  }
  return args;
}

function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

function listAuditFiles(dir) {
  const files = fs.readdirSync(dir).filter(f => /^audit-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  return files.map(f => path.join(dir, f));
}

function inRange(file, from, to) {
  if (!from && !to) return true;
  const m = path.basename(file).match(/^audit-(\d{4}-\d{2}-\d{2})\.jsonl$/);
  if (!m) return false;
  const day = m[1];
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = listAuditFiles(args.auditDir).filter(f => inRange(f, args.from, args.to));
  if (files.length === 0) {
    console.log('[RECON] no audit files found in range', args.auditDir);
    process.exitCode = 2;
    return;
  }

  const byRound = new Map();
  const ensure = (roundId) => {
    if (!byRound.has(roundId)) byRound.set(roundId, { planned: null, sent: null, failed: [], skipped: [], matchId: null, lobbyId: null, winnerId: null, prizeLamports: null });
    return byRound.get(roundId);
  };

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    for (const line of lines) {
      const rec = safeJsonParse(line);
      if (!rec || !rec.type) continue;
      const payload = rec.payload || {};
      const roundId = payload.roundId;
      if (!roundId) continue;
      const row = ensure(roundId);
      if (payload.matchId) row.matchId = payload.matchId;
      if (payload.lobbyId) row.lobbyId = payload.lobbyId;
      if (payload.winnerId) row.winnerId = payload.winnerId;
      if (typeof payload.winnerPrizeLamports === 'number') row.prizeLamports = payload.winnerPrizeLamports;

      if (rec.type === 'payout_planned') row.planned = rec;
      else if (rec.type === 'payout_sent') row.sent = rec;
      else if (rec.type === 'payout_failed') row.failed.push(rec);
      else if (rec.type === 'payout_skipped') row.skipped.push(rec);
    }
  }

  const needsAttention = [];
  const ok = [];
  for (const [roundId, r] of byRound.entries()) {
    const hasPlanned = !!r.planned;
    const hasSent = !!r.sent;
    const hasFailed = r.failed.length > 0;
    const prizeLamports = typeof r.prizeLamports === 'number' ? r.prizeLamports : 0;
    const isMoney = prizeLamports > 0;
    if (!isMoney) continue;
    if (hasPlanned && !hasSent && !r.skipped.length) {
      if (!args.failOnly || hasFailed) needsAttention.push({ roundId, matchId: r.matchId, lobbyId: r.lobbyId, winnerId: r.winnerId, prizeLamports: r.prizeLamports, failed: r.failed.length });
    } else if (hasSent) {
      ok.push({ roundId, matchId: r.matchId, lobbyId: r.lobbyId, winnerId: r.winnerId, txSig: r.sent?.payload?.txSig || r.sent?.payload?.txSignature || r.sent?.payload?.tx_signature });
    }
  }

  console.log('[RECON] files=', files.length, 'roundsSeen=', byRound.size);
  console.log('[RECON] okPaid=', ok.length, 'needsAttention=', needsAttention.length);
  if (needsAttention.length) {
    console.log('[RECON] unpaid rounds (planned but not sent):');
    for (const row of needsAttention.slice(0, 50)) console.log(' -', row);
    if (needsAttention.length > 50) console.log(' ...', needsAttention.length - 50, 'more');
    process.exitCode = 3;
  }
}

main().catch((e) => {
  console.error('[FATAL]', e);
  process.exitCode = 1;
});
