import { pathToFileURL } from 'url';
import { resolve } from 'path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true';
      args[k] = v;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const toPubkey = args.to || args.wallet || args.address;
  const solStr = args.sol;
  const lamportsStr = args.lamports;
  const feeBpsStr = args.feeBps || args.platformFeeBps || '1500';
  if (!toPubkey || (!solStr && !lamportsStr)) {
    console.error('Usage: node scripts/dev-payout.mjs --to <pubkey> --sol 0.001 [--feeBps 1500]');
    process.exit(1);
  }
  const lamports = lamportsStr ? Number(lamportsStr) : Math.floor(Number(solStr) * 1_000_000_000);
  const feeBps = Number(feeBpsStr);
  if (!Number.isFinite(lamports) || lamports <= 0) { console.error('Invalid amount'); process.exit(1); }
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 10000) { console.error('Invalid feeBps'); process.exit(1); }

  const svcUrl = pathToFileURL(resolve('packages/server/dist/SmartContractService.js')).href;
  const web3 = await import('@solana/web3.js');
  const { SmartContractService } = await import(svcUrl);

  // Validate env
  if (!process.env.SOLANA_RPC_ENDPOINT) {
    process.env.SOLANA_RPC_ENDPOINT = 'https://api.devnet.solana.com';
  }
  if (!process.env.PRIZE_POOL_SECRET_KEY) {
    console.error('PRIZE_POOL_SECRET_KEY not set in environment');
    process.exit(1);
  }

  const svc = new SmartContractService();
  const winner = new web3.PublicKey(toPubkey);
  console.log('Sending dev payout...');
  console.log('- RPC:', process.env.SOLANA_RPC_ENDPOINT);
  console.log('- To  :', winner.toBase58());
  console.log('- Amt :', lamports, 'lamports');
  console.log('- Fee :', feeBps, 'bps');

  try {
    const sig = await svc.payoutPrizeLamports(winner, lamports, feeBps);
    console.log('OK signature:', sig);
    console.log('Explorer   :', `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (e) {
    console.error('Payout failed:', e?.message || String(e));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });



