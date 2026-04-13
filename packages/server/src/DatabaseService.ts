import postgres from 'postgres';
import { randomUUID } from 'crypto';

interface Player {
  wallet_address: string;
  username: string | null;
  total_games: number;
  total_wins: number;
  total_kills: number;
  total_earnings: number;
  skill_rating: number;
  created_at: string;
}

interface Game {
  game_id: string;
  winner_wallet: string;
  prize_lamports: number;
  player_count: number;
  ended_at: string;
}

type PayoutStatus = 'planned' | 'sent' | 'failed' | 'skipped';
interface PayoutRecord {
  round_id: string;
  match_id: string | null;
  lobby_id: string | null;
  mode: string | null;
  winner_wallet: string;
  prize_lamports: number;
  platform_fee_bps: number;
  tx_signature: string | null;
  status: PayoutStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface LeaderboardEntry {
  wallet_address: string;
  username: string | null;
  metric_value: number;
  total_games: number;
  rank?: number;
}

export class DatabaseService {
  private sql: postgres.Sql;
  private isClosed = false;
  private cacheRefreshTimer: NodeJS.Timeout | null = null;
  private leaderboardCache: {
    wins: LeaderboardEntry[];
    earnings: LeaderboardEntry[];
    kills: LeaderboardEntry[];
    skillRating: LeaderboardEntry[];
    lastRefresh: number;
  } = { wins: [], earnings: [], kills: [], skillRating: [], lastRefresh: 0 };
  private readonly CACHE_TTL = 60_000;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: { rejectUnauthorized: false },
    });
  }

  async init(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS players (
        wallet_address TEXT PRIMARY KEY,
        username TEXT,
        total_games INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        total_kills INTEGER DEFAULT 0,
        total_earnings BIGINT DEFAULT 0,
        skill_rating INTEGER DEFAULT 1200,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY,
        winner_wallet TEXT,
        prize_lamports BIGINT,
        player_count INTEGER,
        ended_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS payouts (
        round_id TEXT PRIMARY KEY,
        match_id TEXT,
        lobby_id TEXT,
        mode TEXT,
        winner_wallet TEXT NOT NULL,
        prize_lamports BIGINT NOT NULL,
        platform_fee_bps INTEGER NOT NULL,
        tx_signature TEXT,
        status TEXT NOT NULL,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS paid_players (
        wallet_address TEXT PRIMARY KEY,
        lamports BIGINT NOT NULL,
        tier INTEGER NOT NULL,
        signature TEXT,
        paid_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Indexes
    await this.sql`CREATE INDEX IF NOT EXISTS idx_players_wins ON players(total_wins DESC, total_earnings DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_players_earnings ON players(total_earnings DESC, total_wins DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_players_kills ON players(total_kills DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_players_skill_rating ON players(skill_rating DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_games_ended ON games(ended_at DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, updated_at DESC)`;

    console.log('[DB] ✅ Supabase schema initialized');

    // Seed leaderboard cache
    await this._refreshAllCaches();
    this._startCacheRefresh();
  }

  // ---------------------------------------------------------------------------
  // Players
  // ---------------------------------------------------------------------------

  async ensurePlayer(walletAddress: string): Promise<void> {
    await this.sql`
      INSERT INTO players (wallet_address, skill_rating)
      VALUES (${walletAddress}, 1200)
      ON CONFLICT (wallet_address) DO NOTHING
    `;
  }

  async getPlayerStats(walletAddress: string): Promise<Player | null> {
    const rows = await this.sql<Player[]>`
      SELECT * FROM players WHERE wallet_address = ${walletAddress}
    `;
    return rows[0] ?? null;
  }

  async updateUsername(walletAddress: string, username: string): Promise<boolean> {
    try {
      await this.ensurePlayer(walletAddress);
      await this.sql`UPDATE players SET username = ${username} WHERE wallet_address = ${walletAddress}`;
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Games
  // ---------------------------------------------------------------------------

  async recordGameResult(
    winnerWallet: string,
    prizeLamports: number,
    playerCount: number,
    playerKills: Record<string, number>
  ): Promise<void> {
    try {
      const gameId = randomUUID();
      const wallets = Object.keys(playerKills);

      // Ensure all players exist
      for (const w of wallets) await this.ensurePlayer(w);

      await this.sql`
        INSERT INTO games (game_id, winner_wallet, prize_lamports, player_count)
        VALUES (${gameId}, ${winnerWallet}, ${prizeLamports}, ${playerCount})
      `;

      // Update stats for each player
      for (const [wallet, kills] of Object.entries(playerKills)) {
        const isWinner = wallet === winnerWallet;
        await this.sql`
          UPDATE players SET
            total_games   = total_games + 1,
            total_wins    = total_wins  + ${isWinner ? 1 : 0},
            total_kills   = total_kills + ${kills},
            total_earnings= total_earnings + ${isWinner ? prizeLamports : 0}
          WHERE wallet_address = ${wallet}
        `;
      }

      await this._updateSkillRatings(winnerWallet, playerKills);
      console.log(`[DB] ✅ Recorded game: winner=${winnerWallet.slice(0, 8)}, prize=${prizeLamports}, players=${playerCount}`);
    } catch (e) {
      console.error('[DB] ❌ Failed to record game:', e);
    }
  }

  async getRecentGames(limit = 20): Promise<Game[]> {
    return this.sql<Game[]>`SELECT * FROM games ORDER BY ended_at DESC LIMIT ${limit}`;
  }

  // ---------------------------------------------------------------------------
  // Payouts
  // ---------------------------------------------------------------------------

  async getPayoutByRoundId(roundId: string): Promise<PayoutRecord | null> {
    const rows = await this.sql<PayoutRecord[]>`SELECT * FROM payouts WHERE round_id = ${roundId}`;
    return rows[0] ?? null;
  }

  async recordPayoutPlanned(input: {
    roundId: string;
    matchId?: string | null;
    lobbyId?: string | null;
    mode?: string | null;
    winnerWallet: string;
    prizeLamports: number;
    platformFeeBps: number;
  }): Promise<void> {
    await this.sql`
      INSERT INTO payouts (round_id, match_id, lobby_id, mode, winner_wallet, prize_lamports, platform_fee_bps, status, updated_at)
      VALUES (${input.roundId}, ${input.matchId ?? null}, ${input.lobbyId ?? null}, ${input.mode ?? null},
              ${input.winnerWallet}, ${input.prizeLamports}, ${input.platformFeeBps}, 'planned', NOW())
      ON CONFLICT (round_id) DO UPDATE SET
        match_id         = COALESCE(EXCLUDED.match_id, payouts.match_id),
        lobby_id         = COALESCE(EXCLUDED.lobby_id, payouts.lobby_id),
        mode             = COALESCE(EXCLUDED.mode, payouts.mode),
        winner_wallet    = EXCLUDED.winner_wallet,
        prize_lamports   = EXCLUDED.prize_lamports,
        platform_fee_bps = EXCLUDED.platform_fee_bps,
        status           = CASE WHEN payouts.status = 'sent' THEN payouts.status ELSE 'planned' END,
        updated_at       = NOW()
    `;
  }

  async recordPayoutSent(roundId: string, txSignature: string): Promise<void> {
    await this.sql`
      UPDATE payouts SET status = 'sent', tx_signature = ${txSignature}, error = NULL, updated_at = NOW()
      WHERE round_id = ${roundId}
    `;
  }

  async recordPayoutFailed(roundId: string, error: string): Promise<void> {
    await this.sql`
      UPDATE payouts SET status = 'failed', error = ${error.slice(0, 2000)}, updated_at = NOW()
      WHERE round_id = ${roundId}
    `;
  }

  async recordPayoutSkipped(roundId: string, reason: string): Promise<void> {
    await this.sql`
      UPDATE payouts SET status = 'skipped', error = ${reason.slice(0, 2000)}, updated_at = NOW()
      WHERE round_id = ${roundId}
    `;
  }

  async getFailedPayouts(limit = 50): Promise<PayoutRecord[]> {
    return this.sql<PayoutRecord[]>`
      SELECT * FROM payouts WHERE status = 'failed' ORDER BY updated_at DESC LIMIT ${limit}
    `;
  }

  // ---------------------------------------------------------------------------
  // Paid players — crash-safe persistence
  // ---------------------------------------------------------------------------

  async recordPaidPlayer(walletAddress: string, lamports: number, tier: number, signature?: string): Promise<void> {
    await this.sql`
      INSERT INTO paid_players (wallet_address, lamports, tier, signature)
      VALUES (${walletAddress}, ${lamports}, ${tier}, ${signature ?? null})
      ON CONFLICT (wallet_address) DO UPDATE SET
        lamports  = EXCLUDED.lamports,
        tier      = EXCLUDED.tier,
        signature = COALESCE(EXCLUDED.signature, paid_players.signature),
        paid_at   = NOW()
    `;
  }

  async clearPaidPlayer(walletAddress: string): Promise<void> {
    await this.sql`DELETE FROM paid_players WHERE wallet_address = ${walletAddress}`;
  }

  async getAllPaidPlayers(): Promise<Array<{ wallet_address: string; lamports: number; tier: number; signature: string | null }>> {
    return this.sql`SELECT wallet_address, lamports, tier, signature FROM paid_players`;
  }

  // ---------------------------------------------------------------------------
  // Leaderboards (cached)
  // ---------------------------------------------------------------------------

  getTopWins(limit = 100): LeaderboardEntry[] {
    return this.leaderboardCache.wins.slice(0, limit);
  }

  getTopEarnings(limit = 100): LeaderboardEntry[] {
    return this.leaderboardCache.earnings.slice(0, limit);
  }

  getTopKills(limit = 100): LeaderboardEntry[] {
    return this.leaderboardCache.kills.slice(0, limit);
  }

  getTopSkillRating(limit = 100): LeaderboardEntry[] {
    return this.leaderboardCache.skillRating.slice(0, limit);
  }

  async getTotalStats(): Promise<{ totalGames: number; totalPlayers: number; totalPrizes: number }> {
    const [games, players, prizes] = await Promise.all([
      this.sql<[{ count: string }]>`SELECT COUNT(*)::text AS count FROM games`,
      this.sql<[{ count: string }]>`SELECT COUNT(*)::text AS count FROM players WHERE total_games > 0`,
      this.sql<[{ total: string | null }]>`SELECT SUM(prize_lamports)::text AS total FROM games`,
    ]);
    return {
      totalGames: parseInt(games[0].count),
      totalPlayers: parseInt(players[0].count),
      totalPrizes: parseInt(prizes[0].total ?? '0'),
    };
  }

  // ---------------------------------------------------------------------------
  // ELO
  // ---------------------------------------------------------------------------

  async getPlayerElo(walletAddress: string): Promise<number> {
    await this.ensurePlayer(walletAddress);
    const rows = await this.sql<[{ skill_rating: number }]>`
      SELECT skill_rating FROM players WHERE wallet_address = ${walletAddress}
    `;
    return rows[0]?.skill_rating ?? 1200;
  }

  async getPlayersElo(walletAddresses: string[]): Promise<Map<string, number>> {
    const eloMap = new Map<string, number>();
    if (walletAddresses.length === 0) return eloMap;

    const rows = await this.sql<Array<{ wallet_address: string; skill_rating: number }>>`
      SELECT wallet_address, skill_rating FROM players
      WHERE wallet_address = ANY(${this.sql.array(walletAddresses)})
    `;
    for (const row of rows) eloMap.set(row.wallet_address, row.skill_rating);

    for (const addr of walletAddresses) {
      if (!eloMap.has(addr)) {
        await this.ensurePlayer(addr);
        eloMap.set(addr, 1200);
      }
    }
    return eloMap;
  }

  async updatePlayerElo(walletAddress: string, newElo: number): Promise<void> {
    await this.ensurePlayer(walletAddress);
    await this.sql`UPDATE players SET skill_rating = ${newElo} WHERE wallet_address = ${walletAddress}`;
  }

  async updateMatchEloRatings(
    winnerWallet: string,
    playerWallets: string[],
    playerRankings: string[]
  ): Promise<void> {
    for (const w of playerWallets) await this.ensurePlayer(w);

    const currentElos = await this.getPlayersElo(playerWallets);
    const K_FACTOR = 32;
    const ranks = new Map<string, number>();
    for (let i = 0; i < playerRankings.length; i++) ranks.set(playerRankings[i], i);

    for (const playerWallet of playerWallets) {
      const playerElo = currentElos.get(playerWallet) ?? 1200;
      const playerRank = ranks.get(playerWallet) ?? (playerWallets.length - 1);
      let expectedSum = 0;
      let actualSum = 0;
      for (const other of playerWallets) {
        if (other === playerWallet) continue;
        const otherElo = currentElos.get(other) ?? 1200;
        expectedSum += 1 / (1 + Math.pow(10, (otherElo - playerElo) / 400));
        const otherRank = ranks.get(other) ?? (playerWallets.length - 1);
        if (playerRank < otherRank) actualSum += 1;
        else if (playerRank === otherRank) actualSum += 0.5;
      }
      const denom = Math.max(1, playerWallets.length - 1);
      const newElo = Math.round(playerElo + K_FACTOR * (actualSum / denom - expectedSum / denom));
      await this.updatePlayerElo(playerWallet, newElo);
    }
    console.log(`[DB] ✅ Updated ELO for ${playerWallets.length} players, winner: ${winnerWallet.slice(0, 8)}`);
  }

  calculateSkillRatingChange(
    winnerRating: number, winnerGames: number,
    loserRating: number, loserGames: number
  ): { winnerNewRating: number; loserNewRating: number } {
    const getK = (g: number) => g < 10 ? 60 : g < 30 ? 40 : g < 100 ? 25 : 20;
    const winnerExpected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const loserExpected = 1 - winnerExpected;
    return {
      winnerNewRating: Math.round(winnerRating + getK(winnerGames) * (1 - winnerExpected)),
      loserNewRating:  Math.round(loserRating  + getK(loserGames)  * (0 - loserExpected)),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _refreshAllCaches(): Promise<void> {
    try {
      const [wins, earnings, kills, skillRating] = await Promise.all([
        this._fetchLeaderboard('total_wins', 100),
        this._fetchLeaderboard('total_earnings', 100),
        this._fetchLeaderboard('total_kills', 100),
        this._fetchLeaderboard('skill_rating', 100),
      ]);
      this.leaderboardCache = { wins, earnings, kills, skillRating, lastRefresh: Date.now() };
    } catch (e) {
      console.error('[DB] ❌ Cache refresh failed:', e);
    }
  }

  private async _fetchLeaderboard(column: string, limit: number): Promise<LeaderboardEntry[]> {
    const rows = await this.sql<LeaderboardEntry[]>`
      SELECT wallet_address, username, ${this.sql(column)} AS metric_value, total_games
      FROM players WHERE total_games > 0
      ORDER BY ${this.sql(column)} DESC
      LIMIT ${limit}
    `;
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  private _startCacheRefresh(): void {
    this.cacheRefreshTimer = setInterval(async () => {
      if (this.isClosed) return;
      await this._refreshAllCaches();
      console.log('[DB] 🔄 Leaderboard cache refreshed');
    }, this.CACHE_TTL);
    console.log('[DB] ✅ Cache refresh started (60s interval)');
  }

  private async _updateSkillRatings(
    winnerWallet: string,
    playerKills: Record<string, number>
  ): Promise<void> {
    try {
      const wallets = Object.keys(playerKills);
      if (wallets.length < 2) return;

      type Row = { wallet_address: string; skill_rating: number; total_games: number };
      const rows = await this.sql<Row[]>`
        SELECT wallet_address, skill_rating, total_games FROM players
        WHERE wallet_address = ANY(${this.sql.array(wallets)})
      `;

      const winner = rows.find(r => r.wallet_address === winnerWallet);
      if (!winner) return;
      const losers = rows.filter(r => r.wallet_address !== winnerWallet);
      if (losers.length === 0) return;

      const avgLoserRating = losers.reduce((s, r) => s + r.skill_rating, 0) / losers.length;
      const avgLoserGames  = losers.reduce((s, r) => s + r.total_games,  0) / losers.length;
      const { winnerNewRating } = this.calculateSkillRatingChange(
        winner.skill_rating, winner.total_games, avgLoserRating, avgLoserGames
      );
      await this.updatePlayerElo(winnerWallet, winnerNewRating);

      for (const loser of losers) {
        const { loserNewRating } = this.calculateSkillRatingChange(
          winner.skill_rating, winner.total_games, loser.skill_rating, loser.total_games
        );
        await this.updatePlayerElo(loser.wallet_address, loserNewRating);
      }
      console.log(`[SKILL] Updated: winner ${winner.wallet_address.slice(0,8)} ${winner.skill_rating}→${winnerNewRating}`);
    } catch (e) {
      console.error('[SKILL] Failed to update ratings:', e);
    }
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    if (this.cacheRefreshTimer) clearInterval(this.cacheRefreshTimer);
    this.sql.end().catch(() => {});
  }
}
