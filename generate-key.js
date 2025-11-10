const { Keypair } = require('@solana/web3.js');

const keypair = Keypair.generate();
const pubkey = keypair.publicKey.toBase58();
const secretArray = Array.from(keypair.secretKey);

console.log('New prize pool keypair (DEVNET)');
console.log('Public key:', pubkey);
console.log('Secret (JSON array, use for PRIZE_POOL_SECRET_KEY):');
console.log(JSON.stringify(secretArray));
