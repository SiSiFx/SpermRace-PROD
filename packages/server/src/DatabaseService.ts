import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

interface Player {
  wallet_address: string;
  username: string | null;
  total_games: number;
  total_wins: number;
  total_kills: number;
  total_earnings: number; // lamports
  created_at: string;
}

interface Game {
  game_id: string;
  winner_wallet: string;
  prize_lamports: number;
  player_count: number;
  ended_at: string;
}

interface LeaderboardEntry {
  wallet_address: string;
  username: string | null;
  metric_value: number;
  total_games: number;
  rank?: number;
}

export class DatabaseService {
  private db: Database.Database;
  private leaderboardCache: {
    wins: LeaderboardEntry[];
    earnings: LeaderboardEntry[];
    kills: LeaderboardEntry[];
    lastRefresh: number;
  };
  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    this.initSchema();
    
    this.leaderboardCache = {
      wins: [],
      earnings: [],
      kills: [],
      lastRefresh: 0,
    };

    // Start background refresh
    this.startCacheRefresh();
  }

  private initSchema() {
    // Players table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        wallet_address TEXT PRIMARY KEY,
        username TEXT,
        total_games INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        total_kills INTEGER DEFAULT 0,
        total_earnings INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Games table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        game_id TEXT PRIMARY KEY,
        winner_wallet TEXT,
        prize_lamports INTEGER,
        player_count INTEGER,
        ended_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes for fast queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_players_wins 
        ON players(total_wins DESC, total_earnings DESC);
      
      CREATE INDEX IF NOT EXISTS idx_players_earnings 
        ON players(total_earnings DESC, total_wins DESC);
      
      CREATE INDEX IF NOT EXISTS idx_players_kills 
        ON players(total_kills DESC);
      
      CREATE INDEX IF NOT EXISTS idx_games_ended 
        ON games(ended_at DESC);
    `);

    console.log('[DB] ✅ Database schema initialized');
  }

  // Ensure player exists (upsert)
  ensurePlayer(walletAddress: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO players (wallet_address)
      VALUES (?)
      ON CONFLICT(wallet_address) DO NOTHING
    `);
    stmt.run(walletAddress);
  }

  // Record game result (fire-and-forget, async)
  recordGameResult(
    winnerWallet: string,
    prizeLamports: number,
    playerCount: number,
    playerKills: Record<string, number> // { wallet: kills }
  ): void {
    try {
      const gameId = randomUUID();

      // Ensure all players exist
      for (const wallet of Object.keys(playerKills)) {
        this.ensurePlayer(wallet);
      }

      // Insert game record
      const gameStmt = this.db.prepare(`
        INSERT INTO games (game_id, winner_wallet, prize_lamports, player_count)
        VALUES (?, ?, ?, ?)
      `);
      gameStmt.run(gameId, winnerWallet, prizeLamports, playerCount);

      // Update all participants
      const updateStmt = this.db.prepare(`
        UPDATE players
        SET 
          total_games = total_games + 1,
          total_wins = total_wins + ?,
          total_kills = total_kills + ?,
          total_earnings = total_earnings + ?
        WHERE wallet_address = ?
      `);

      for (const [wallet, kills] of Object.entries(playerKills)) {
        const isWinner = wallet === winnerWallet ? 1 : 0;
        const earnings = isWinner ? prizeLamports : 0;
        updateStmt.run(isWinner, kills, earnings, wallet);
      }

      console.log(`[DB] ✅ Recorded game: winner=${winnerWallet.slice(0, 8)}, prize=${prizeLamports}, players=${playerCount}`);
    } catch (error) {
      console.error('[DB] ❌ Failed to record game:', error);
    }
  }

  // Get player stats
  getPlayerStats(walletAddress: string): Player | null {
    const stmt = this.db.prepare(`
      SELECT * FROM players WHERE wallet_address = ?
    `);
    return stmt.get(walletAddress) as Player | null;
  }

  // Get top N by wins (from cache)
  getTopWins(limit: number = 100): LeaderboardEntry[] {
    if (Date.now() - this.leaderboardCache.lastRefresh < this.CACHE_TTL) {
      return this.leaderboardCache.wins.slice(0, limit);
    }
    return this.refreshCache('wins', limit);
  }

  // Get top N by earnings (from cache)
  getTopEarnings(limit: number = 100): LeaderboardEntry[] {
    if (Date.now() - this.leaderboardCache.lastRefresh < this.CACHE_TTL) {
      return this.leaderboardCache.earnings.slice(0, limit);
    }
    return this.refreshCache('earnings', limit);
  }

  // Get top N by kills (from cache)
  getTopKills(limit: number = 100): LeaderboardEntry[] {
    if (Date.now() - this.leaderboardCache.lastRefresh < this.CACHE_TTL) {
      return this.leaderboardCache.kills.slice(0, limit);
    }
    return this.refreshCache('kills', limit);
  }

  // Refresh cache for specific leaderboard
  private refreshCache(type: 'wins' | 'earnings' | 'kills', limit: number = 100): LeaderboardEntry[] {
    const column = type === 'wins' ? 'total_wins' : type === 'earnings' ? 'total_earnings' : 'total_kills';
    
    const stmt = this.db.prepare(`
      SELECT 
        wallet_address,
        username,
        ${column} as metric_value,
        total_games
      FROM players
      WHERE total_games > 0
      ORDER BY ${column} DESC
      LIMIT ?
    `);

    const results = stmt.all(limit) as LeaderboardEntry[];
    
    // Add ranks
    results.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    this.leaderboardCache[type] = results;
    return results;
  }

  // Background cache refresh
  private startCacheRefresh(): void {
    setInterval(() => {
      try {
        this.refreshCache('wins', 100);
        this.refreshCache('earnings', 100);
        this.refreshCache('kills', 100);
        this.leaderboardCache.lastRefresh = Date.now();
        console.log('[DB] 🔄 Leaderboard cache refreshed');
      } catch (error) {
        console.error('[DB] ❌ Cache refresh failed:', error);
      }
    }, this.CACHE_TTL);

    // Initial refresh
    this.refreshCache('wins', 100);
    this.refreshCache('earnings', 100);
    this.refreshCache('kills', 100);
    this.leaderboardCache.lastRefresh = Date.now();
    console.log('[DB] ✅ Cache refresh started (60s interval)');
  }

  // Get recent games
  getRecentGames(limit: number = 20): Game[] {
    const stmt = this.db.prepare(`
      SELECT * FROM games
      ORDER BY ended_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as Game[];
  }

  // Update player username
  updateUsername(walletAddress: string, username: string): boolean {
    try {
      this.ensurePlayer(walletAddress);
      const stmt = this.db.prepare(`
        UPDATE players
        SET username = ?
        WHERE wallet_address = ?
      `);
      stmt.run(username, walletAddress);
      return true;
    } catch (error) {
      console.error('[DB] Failed to update username:', error);
      return false;
    }
  }

  // Get total stats
  getTotalStats(): { totalGames: number; totalPlayers: number; totalPrizes: number } {
    const gamesStmt = this.db.prepare('SELECT COUNT(*) as count FROM games');
    const playersStmt = this.db.prepare('SELECT COUNT(*) as count FROM players WHERE total_games > 0');
    const prizesStmt = this.db.prepare('SELECT SUM(prize_lamports) as total FROM games');

    const games = gamesStmt.get() as { count: number };
    const players = playersStmt.get() as { count: number };
    const prizes = prizesStmt.get() as { total: number | null };

    return {
      totalGames: games.count,
      totalPlayers: players.count,
      totalPrizes: prizes.total || 0,
    };
  }

  close(): void {
    this.db.close();
  }
}
