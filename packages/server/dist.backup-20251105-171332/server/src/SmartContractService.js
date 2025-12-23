import { Connection, PublicKey, SystemProgram, Transaction, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
// =================================================================================================
// Constants
// =================================================================================================
// Mainnet-beta RPC endpoint
const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
// The public key of the prize pool wallet (custodial/program-owned)
const PRIZE_POOL_WALLET = new PublicKey(process.env.PRIZE_POOL_WALLET || '5YKciEvHaGKC6xDntXqWTp3UEkGww5bU72Z7eckxR4j9');
const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET ? new PublicKey(process.env.PLATFORM_FEE_WALLET) : PRIZE_POOL_WALLET;
// =================================================================================================
// SmartContractService
// =================================================================================================
export class SmartContractService {
    connection;
    prizePoolKeypair;
    constructor() {
        this.connection = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
        this.prizePoolKeypair = null;
        const secret = process.env.PRIZE_POOL_SECRET_KEY;
        if (secret) {
            try {
                // Accept base58 or JSON array formats
                let secretBytes = null;
                try {
                    secretBytes = bs58.decode(secret);
                }
                catch {
                    // Not base58, try JSON array
                    try {
                        const arr = JSON.parse(secret);
                        if (Array.isArray(arr)) {
                            secretBytes = new Uint8Array(arr);
                        }
                    }
                    catch {
                        // fallthrough
                    }
                }
                if (!secretBytes)
                    throw new Error('Invalid PRIZE_POOL_SECRET_KEY format');
                this.prizePoolKeypair = Keypair.fromSecretKey(secretBytes);
                // Optional: warn on mismatch with configured public prize pool wallet
                try {
                    const derivedPubkey = this.prizePoolKeypair.publicKey.toBase58();
                    if (derivedPubkey !== PRIZE_POOL_WALLET.toBase58()) {
                        console.warn(`PRIZE_POOL_SECRET_KEY pubkey (${derivedPubkey}) does not match PRIZE_POOL_WALLET (${PRIZE_POOL_WALLET.toBase58()}). Using secret key pubkey for payouts.`);
                    }
                }
                catch { }
            }
            catch (e) {
                console.error('Failed to parse PRIZE_POOL_SECRET_KEY:', e);
                this.prizePoolKeypair = null;
            }
        }
    }
    getPrizePoolAddressBase58() {
        return PRIZE_POOL_WALLET.toBase58();
    }
    isPayoutConfigured() {
        return !!this.prizePoolKeypair;
    }
    async getPrizePoolBalanceLamports() {
        try {
            const pubkey = this.prizePoolKeypair?.publicKey || PRIZE_POOL_WALLET;
            return await this.connection.getBalance(pubkey, { commitment: 'processed' });
        }
        catch {
            return -1;
        }
    }
    /**
     * Converts a USD entry fee to its equivalent in SOL using Jupiter's price API.
     */
    async getEntryFeeInSol(entryFeeUsd) {
        const solPriceUsd = await this.fetchSolPriceUsd();
        if (!solPriceUsd || solPriceUsd <= 0)
            throw new Error('SOL price fetch failed');
        return entryFeeUsd / solPriceUsd;
    }
    async fetchSolPriceUsd() {
        // Prefer unified server price endpoint first, then fall back to public sources
        const port = process.env.PORT || '8080';
        const override = process.env.INTERNAL_PRICE_URL; // e.g., http://127.0.0.1:8080/api/sol-price
        const internalUrl = override || `http://127.0.0.1:${port}/api/sol-price`;
        const tryFetch = async (url, pick) => {
            try {
                const ctrl = new AbortController();
                const id = setTimeout(() => ctrl.abort(), 5000);
                const r = await fetch(url, { signal: ctrl.signal });
                clearTimeout(id);
                if (!r.ok)
                    return null;
                const j = await r.json();
                const v = pick(j);
                return Number.isFinite(v) ? v : null;
            }
            catch {
                return null;
            }
        };
        const sources = [
            { url: internalUrl, pick: j => Number(j?.usd) || null },
            { url: 'https://price.jup.ag/v6/price?ids=SOL', pick: j => Number(j?.data?.SOL?.price) || null },
            { url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', pick: j => Number(j?.solana?.usd) || null },
        ];
        for (const s of sources) {
            const val = await tryFetch(s.url, s.pick);
            if (val && val > 0)
                return val;
        }
        throw new Error('All price sources failed');
    }
    async getEntryFeeInLamports(entryFeeUsd) {
        const sol = await this.getEntryFeeInSol(entryFeeUsd);
        return Math.ceil(sol * 1_000_000_000);
    }
    /**
     * Creates a transaction for a player to pay their entry fee.
     * This transaction would be sent to the client to be signed.
     */
    async createEntryFeeTransactionBase64(playerPublicKey, lamports) {
        const transaction = new Transaction().add(SystemProgram.transfer({
            fromPubkey: playerPublicKey,
            toPubkey: PRIZE_POOL_WALLET,
            lamports,
        }));
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = playerPublicKey;
        const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
        const uint8 = new Uint8Array(serialized.buffer, serialized.byteOffset, serialized.byteLength);
        const binary = Array.from(uint8).map((b) => String.fromCharCode(b)).join('');
        const txBase64 = Buffer.from(binary, 'binary').toString('base64');
        return { txBase64, lamports, recentBlockhash: blockhash, prizePool: PRIZE_POOL_WALLET.toBase58() };
    }
    /**
     * Triggers the smart contract to pay out the prize pool to the winner.
     * This would be called by the server at the end of a round.
     */
    async verifyEntryFee(signature, expectedLamports) {
        // Prefer parsed transaction for robust instruction parsing across legacy and v0
        try {
            const parsed = await this.connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
            // Check if transaction failed
            if (parsed && parsed.meta && parsed.meta.err) {
                console.log('[PAYMENT] ❌ Transaction failed on-chain:', parsed.meta.err);
                const logs = parsed.meta.logMessages || [];
                const insufficientFunds = logs.some(log => log.includes('insufficient lamports'));
                if (insufficientFunds) {
                    return { ok: false, error: 'Insufficient balance. Please add more SOL to your wallet.' };
                }
                return { ok: false, error: 'Transaction failed on blockchain' };
            }
            if (parsed && parsed.meta && !parsed.meta.err) {
                const instructions = parsed.transaction.message?.instructions || [];
                for (const ix of instructions) {
                    if (ix?.program === 'system' && ix?.parsed?.type === 'transfer') {
                        const info = ix.parsed.info;
                        const destination = info?.destination;
                        const lamports = typeof info?.lamports === 'number' ? info.lamports : parseInt(info?.lamports || '0', 10);
                        if (destination === PRIZE_POOL_WALLET.toBase58() && lamports === expectedLamports) {
                            const keys = parsed.transaction.message?.accountKeys || [];
                            const payerKey = keys[0]?.pubkey || keys[0];
                            return { ok: true, payer: typeof payerKey === 'string' ? payerKey : payerKey?.toBase58?.() };
                        }
                    }
                }
            }
        }
        catch (_) {
            // fall through to non-parsed flow
        }
        // Fallback: legacy getTransaction path, using balance deltas
        try {
            const tx = await this.connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
            if (!tx || !tx.meta)
                return { ok: false };
            // Check if transaction failed
            if (tx.meta.err) {
                console.log('[PAYMENT] ❌ Transaction failed (legacy):', tx.meta.err);
                const logs = tx.meta.logMessages || [];
                const insufficientFunds = logs.some(log => log.includes('insufficient lamports'));
                if (insufficientFunds) {
                    return { ok: false, error: 'Insufficient balance. Please add more SOL to your wallet.' };
                }
                return { ok: false, error: 'Transaction failed on blockchain' };
            }
            const message = tx.transaction.message;
            // Best-effort extraction of account keys across legacy and v0
            let accountKeys = [];
            try {
                const raw = message.accountKeys;
                if (Array.isArray(raw)) {
                    accountKeys = raw.map((k) => (typeof k === 'string' ? k : k.pubkey?.toBase58?.() || String(k)));
                }
                else if (raw?.staticAccountKeys) {
                    accountKeys = raw.staticAccountKeys.map((k) => (typeof k === 'string' ? k : k.toBase58?.() || String(k)));
                }
            }
            catch { }
            const prizeIndex = accountKeys.findIndex((k) => k === PRIZE_POOL_WALLET.toBase58());
            if (prizeIndex === -1)
                return { ok: false };
            const pre = tx.meta.preBalances;
            const post = tx.meta.postBalances;
            const prizeDelta = (post[prizeIndex] ?? 0) - (pre[prizeIndex] ?? 0);
            if (prizeDelta !== expectedLamports)
                return { ok: false };
            const payer = accountKeys[0];
            const payerIndex = 0;
            const payerDelta = (pre[payerIndex] ?? 0) - (post[payerIndex] ?? 0);
            if (payerDelta < expectedLamports)
                return { ok: false };
            return { ok: true, payer };
        }
        catch (_) {
            return { ok: false };
        }
    }
    /**
     * Refunds entry fee to a player when lobby is cancelled
     */
    async refundPlayer(playerPublicKey, lamports) {
        if (!this.prizePoolKeypair) {
            throw new Error('Prize pool keypair not configured - cannot issue refund');
        }
        console.log(`[REFUND] Initiating refund of ${lamports} lamports to ${playerPublicKey}`);
        try {
            const recipient = new PublicKey(playerPublicKey);
            const latestBlockhash = await this.connection.getLatestBlockhash('finalized');
            const transaction = new Transaction().add(SystemProgram.transfer({
                fromPubkey: this.prizePoolKeypair.publicKey,
                toPubkey: recipient,
                lamports
            }));
            transaction.recentBlockhash = latestBlockhash.blockhash;
            transaction.feePayer = this.prizePoolKeypair.publicKey;
            transaction.sign(this.prizePoolKeypair);
            const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                maxRetries: 3
            });
            console.log(`[REFUND] Transaction sent: ${signature}`);
            await this.connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            }, 'confirmed');
            console.log(`[REFUND] ✅ Refund confirmed to ${playerPublicKey}: ${lamports} lamports`);
            return signature;
        }
        catch (error) {
            console.error(`[REFUND] ❌ Failed to refund ${playerPublicKey}:`, error);
            throw error;
        }
    }
    async payoutPrizeLamports(winnerPublicKey, lamports, platformFeeBps = 1500) {
        if (!this.prizePoolKeypair)
            throw new Error('Prize pool key not configured');
        // Preflight balance check
        const prizeBalance = await this.connection.getBalance(this.prizePoolKeypair.publicKey, { commitment: 'processed' });
        const feeCushion = 10_000; // lamports cushion for fees
        if (prizeBalance < lamports + feeCushion) {
            throw new Error(`Insufficient prize pool balance: have ${prizeBalance}, need ${lamports + feeCushion}`);
        }
        const winnerAmount = Math.floor(lamports * (10_000 - platformFeeBps) / 10_000);
        const platformAmount = lamports - winnerAmount;
        const instructions = [
            SystemProgram.transfer({ fromPubkey: this.prizePoolKeypair.publicKey, toPubkey: winnerPublicKey, lamports: winnerAmount }),
        ];
        if (platformAmount > 0 && PLATFORM_FEE_WALLET) {
            instructions.push(SystemProgram.transfer({ fromPubkey: this.prizePoolKeypair.publicKey, toPubkey: PLATFORM_FEE_WALLET, lamports: platformAmount }));
        }
        const tx = new Transaction().add(...instructions);
        tx.feePayer = this.prizePoolKeypair.publicKey;
        const { blockhash } = await this.connection.getLatestBlockhash('finalized');
        tx.recentBlockhash = blockhash;
        // Retry/backoff send
        let attempt = 0;
        let lastErr;
        while (attempt < 3) {
            try {
                const sig = await sendAndConfirmTransaction(this.connection, tx, [this.prizePoolKeypair]);
                return sig;
            }
            catch (e) {
                lastErr = e;
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                attempt++;
            }
        }
        throw lastErr || new Error('Payout failed');
    }
}
