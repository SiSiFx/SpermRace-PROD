# Critical Security Fixes Required Before Production

**Status**: 🔴 **NOT PRODUCTION READY**
**Risk Level**: CRITICAL - Do not deploy with real cryptocurrency until fixed

## P0 - CRITICAL (Must Fix Before Launch)

### 1. Remove Private Key from .env File ⚠️ URGENT

**Current Issue**: Prize pool private key stored in plaintext
**File**: `packages/server/.env:3`
**Risk**: Complete loss of all tournament funds if exposed

**Fix**:
```bash
# Step 1: Generate NEW production keypair
solana-keygen new --outfile ~/.config/solana/prize-pool-prod.json

# Step 2: Fund the new wallet (NEVER reuse dev keys in production)
solana transfer NEW_WALLET_ADDRESS 10 --from OLD_WALLET

# Step 3: Use PM2 encrypted environment variables
pm2 set pm2-server-monit:secret_key "$(cat ~/.config/solana/prize-pool-prod.json)"

# Step 4: Update ecosystem.config.js to read from PM2
env: {
  PRIZE_POOL_SECRET_KEY: process.env.PM2_SECRET_KEY
}

# Step 5: Delete old .env file
rm packages/server/.env
```

### 2. Fix Payment Verification Race Condition

**Current Issue**: Same transaction signature can be submitted to multiple lobbies
**File**: `packages/server/src/index.ts:649-711`
**Risk**: Free entry to multiple tournaments with one payment

**Fix**: Add this to `packages/server/src/index.ts`:

```typescript
// Global signature tracking (add at top of file)
const usedSignatures = new Set<string>();
const VERIFICATION_LOCKS = new Map<string, Promise<any>>();

// In 'entryFeeSignature' handler (line ~649)
case 'entryFeeSignature': {
  const signature = String(message?.payload?.signature || '').trim();

  // Validate signature format
  if (!signature || signature.length < 50 || signature.length > 100) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid signature' } }));
    return;
  }

  // Check if signature already used (atomic)
  if (usedSignatures.has(signature)) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Signature already used' } }));
    return;
  }

  // Check if verification in progress for this signature
  if (VERIFICATION_LOCKS.has(signature)) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Verification in progress' } }));
    return;
  }

  // Mark signature as used BEFORE verification starts
  usedSignatures.add(signature);

  const verificationPromise = (async () => {
    try {
      // Existing verification logic here...
      const verified = await verifyWithRetry(signature, expectedLamports);

      if (!verified) {
        usedSignatures.delete(signature); // Rollback on failure
        throw new Error('Verification failed');
      }

      return verified;
    } finally {
      VERIFICATION_LOCKS.delete(signature);
    }
  })();

  VERIFICATION_LOCKS.set(signature, verificationPromise);
  await verificationPromise;
}
```

### 3. Make Payout Atomic with Game State

**Current Issue**: Winner declared even if payout fails
**File**: `packages/server/src/GameWorld.ts:81-113`
**Risk**: Players win but don't receive funds

**Fix**: Update `endRound` method in `packages/server/src/GameWorld.ts`:

```typescript
private async endRound(winnerId: string): Promise<void> {
  let txSig: string | undefined = undefined;
  let prizeAmount = 0;

  // Calculate prize BEFORE state update
  if (this.currentLobby && winnerId !== 'draw') {
    const { players, entryFee } = this.currentLobby;
    const lamportsPerPlayer = await this.smartContractService.getEntryFeeInLamports(entryFee);
    const totalLamports = lamportsPerPlayer * players.length;
    const winnerPrizeLamports = Math.floor(totalLamports * 0.85);
    prizeAmount = winnerPrizeLamports / 1_000_000_000;

    const isBotWinner = winnerId.startsWith('BOT_');
    if (!isBotWinner) {
      try {
        const { PublicKey } = await import('@solana/web3.js');
        const winnerPk = new PublicKey(winnerId);

        // Retry payout up to 5 times
        let payoutAttempts = 0;
        while (payoutAttempts < 5) {
          try {
            txSig = await this.smartContractService.payoutPrizeLamports(
              winnerPk,
              winnerPrizeLamports,
              1500
            );
            break; // Success
          } catch (e: any) {
            payoutAttempts++;
            if (payoutAttempts >= 5) {
              // CRITICAL: Log failed payout for manual resolution
              console.error('CRITICAL PAYOUT FAILURE:', {
                winnerId,
                lamports: winnerPrizeLamports,
                entryFee,
                players: players.length,
                error: e.message,
                timestamp: new Date().toISOString()
              });

              // DO NOT update game state
              this.onRoundEnd?.(winnerId, prizeAmount, undefined);
              return; // Exit without clearing lobby
            }
            // Exponential backoff
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, payoutAttempts)));
          }
        }
      } catch (e: any) {
        console.error('CRITICAL: Payout failed, game state NOT updated:', e);
        this.onRoundEnd?.(winnerId, prizeAmount, undefined);
        return; // Prevent state update
      }
    }
  }

  // ONLY update state after successful payout (or bot/draw)
  this.gameState.status = 'finished';
  this.gameState.winnerId = winnerId;
  this.onRoundEnd?.(winnerId, prizeAmount, txSig);
  this.currentLobby = null;
}
```

### 4. Zero-Tolerance Authentication Policy

**Current Issue**: Allows 3 unauthenticated messages before disconnect
**File**: `packages/server/src/index.ts:486-501`
**Risk**: Attackers can spam server before authentication

**Fix**: Update `packages/server/ENV.sample` and all `.env` files:

```bash
# BEFORE
WS_UNAUTH_MAX=3

# AFTER
WS_UNAUTH_MAX=0
```

And update message handler in `packages/server/src/index.ts`:

```typescript
// Whitelist of allowed messages before auth
const ALLOWED_DURING_AUTH = new Set(['authenticate']);

if (!ALLOWED_DURING_AUTH.has(t) && !authed) {
  ws.close(4003, 'Authentication required');
  return;
}
```

### 5. Global Nonce Tracking (Prevent Replay)

**Current Issue**: Nonce only tracked per WebSocket, not globally
**File**: `packages/server/src/index.ts:528-539`
**Risk**: Replay attack with old signed messages

**Fix**: Add global nonce cache in `packages/server/src/index.ts`:

```typescript
// Add at top of file
const GLOBAL_NONCE_CACHE = new Map<string, { issuedAt: number; consumed: boolean }>();

// In 'authenticate' handler
case 'authenticate': {
  const { nonce, signature, publicKey } = message.payload;

  // Check global nonce status
  const globalNonce = GLOBAL_NONCE_CACHE.get(nonce);
  if (globalNonce?.consumed) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Nonce already used' } }));
    ws.close(4003, 'Nonce reuse detected');
    return;
  }

  // ... existing verification ...

  // Mark consumed globally
  GLOBAL_NONCE_CACHE.set(nonce, { issuedAt: Date.now(), consumed: true });
  if (nonceRec) nonceRec.consumed = true;
}

// Cleanup old nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of GLOBAL_NONCE_CACHE.entries()) {
    if (now - data.issuedAt > NONCE_TTL_MS * 2) {
      GLOBAL_NONCE_CACHE.delete(nonce);
    }
  }
}, 60000); // Every minute
```

## P1 - HIGH PRIORITY (Fix Soon After Launch)

### 6. Add Input Validation

**File**: `packages/server/src/GameWorld.ts` or `packages/server/src/Player.ts`

```typescript
handlePlayerInput(playerId: string, input: PlayerInput): void {
  const player = this.players.get(playerId);
  if (!player || !player.isAlive) return;

  // Validate target distance
  const dx = input.target.x - player.sperm.position.x;
  const dy = input.target.y - player.sperm.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const MAX_REASONABLE_TARGET_DIST = 5000;
  if (dist > MAX_REASONABLE_TARGET_DIST) {
    console.warn(`[ANTI-CHEAT] ${playerId} unreasonable target (${dist}px)`);
    const ratio = MAX_REASONABLE_TARGET_DIST / dist;
    input.target.x = player.sperm.position.x + dx * ratio;
    input.target.y = player.sperm.position.y + dy * ratio;
  }

  // Clamp to world bounds
  input.target.x = Math.max(0, Math.min(this.gameState.world.width, input.target.x));
  input.target.y = Math.max(0, Math.min(this.gameState.world.height, input.target.y));

  player.setInput(input);
}
```

### 7. Add RPC Rate Limiting

**File**: `packages/server/src/SmartContractService.ts`

```bash
# Install bottleneck
pnpm add bottleneck --filter server
```

```typescript
import Bottleneck from 'bottleneck';

export class SmartContractService {
  private rateLimiter: Bottleneck;

  constructor() {
    this.rateLimiter = new Bottleneck({
      reservoir: 100,
      reservoirRefreshAmount: 100,
      reservoirRefreshInterval: 10 * 1000,
      maxConcurrent: 10,
      minTime: 100
    });
  }

  async getTransaction(signature: string): Promise<any> {
    return this.rateLimiter.schedule(() =>
      this.connection.getTransaction(signature, { commitment: 'confirmed' })
    );
  }
}
```

### 8. Add Security Logging

```bash
# Install winston
pnpm add winston --filter server
```

```typescript
import winston from 'winston';

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log', level: 'warn' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Log security events
securityLogger.warn('Authentication failed', {
  event: 'auth_failed',
  publicKey: publicKey.slice(0, 8) + '...',
  ip: req.socket.remoteAddress,
  timestamp: Date.now()
});
```

## Testing Checklist

Before deploying:

- [ ] Test payment flow with devnet SOL
- [ ] Verify payout succeeds and game state updates correctly
- [ ] Test payout failure scenario (disconnect RPC during payout)
- [ ] Verify signature reuse is blocked
- [ ] Test nonce replay attack is blocked
- [ ] Test unauthenticated message rejection
- [ ] Load test with 32+ concurrent players
- [ ] Verify RPC rate limiting works
- [ ] Review all security logs for anomalies

## Deployment Steps

1. Apply all P0 fixes
2. Test thoroughly on devnet
3. Security audit by 3rd party (recommended)
4. Deploy to VPS with production environment
5. Deploy client to Vercel
6. Monitor logs for 24 hours before announcing
7. Start with low-value tournaments ($1-$5)
8. Gradually increase stakes after stability proven

## Emergency Contacts

- Server down: Check PM2 logs, restart if needed
- Failed payout: Check `logs/security.log` for CRITICAL entries
- Suspicious activity: Review `logs/security.log` for auth failures

## Security Monitoring

Set up alerts for:
- Failed authentication attempts (>5/minute from same IP)
- Failed payouts (any occurrence)
- High memory usage (>80%)
- RPC rate limit errors
- Unusual player behavior (speed hacking, teleportation)

---

**Last Updated**: 2025-10-04
**Next Review**: Before production deployment
**Responsible**: Development team + Security auditor
