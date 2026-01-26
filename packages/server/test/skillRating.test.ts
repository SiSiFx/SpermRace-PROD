import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../src/DatabaseService.js';
import { unlinkSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

describe('Skill Rating System', () => {
  const TEST_DB_PATH = `./test-skills-${randomUUID()}.db`;
  let db: DatabaseService;

  beforeEach(() => {
    // Clean up test database if it exists
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    db = new DatabaseService(TEST_DB_PATH);
  });

  describe('ELO Calculation', () => {
    it('should calculate expected score correctly for equal ratings', () => {
      // Expected score should be 0.5 when ratings are equal
      const expectedScore = (db as any).calculateExpectedScore(1200, 1200);
      expect(expectedScore).toBeCloseTo(0.5, 4);
    });

    it('should calculate expected score correctly for higher rated player', () => {
      // 1600 vs 1200: higher rated player should have > 0.5 expected score
      const expectedScore = (db as any).calculateExpectedScore(1600, 1200);
      expect(expectedScore).toBeGreaterThan(0.5);
      expect(expectedScore).toBeLessThan(1.0);
    });

    it('should calculate expected score correctly for lower rated player', () => {
      // 1200 vs 1600: lower rated player should have < 0.5 expected score
      const expectedScore = (db as any).calculateExpectedScore(1200, 1600);
      expect(expectedScore).toBeGreaterThan(0.0);
      expect(expectedScore).toBeLessThan(0.5);
    });

    it('should return expected score close to 1 for much higher rated player', () => {
      // 2000 vs 1000: huge difference
      const expectedScore = (db as any).calculateExpectedScore(2000, 1000);
      expect(expectedScore).toBeGreaterThan(0.9);
    });
  });

  describe('K-Factor Calculation', () => {
    it('should return high K-factor for new players (< 10 games)', () => {
      const kFactor = (db as any).getKFactor(5);
      expect(kFactor).toBe(60);
    });

    it('should return medium-high K-factor for players with 10-29 games', () => {
      const kFactor = (db as any).getKFactor(15);
      expect(kFactor).toBe(40);
    });

    it('should return medium K-factor for players with 30-99 games', () => {
      const kFactor = (db as any).getKFactor(50);
      expect(kFactor).toBe(25);
    });

    it('should return low K-factor for veteran players (100+ games)', () => {
      const kFactor = (db as any).getKFactor(150);
      expect(kFactor).toBe(20);
    });
  });

  describe('Skill Rating Change Calculation', () => {
    it('should increase winner rating and decrease loser rating', () => {
      const { winnerNewRating, loserNewRating } = (db as any).calculateSkillRatingChange(
        1200, // winner rating
        50,   // winner games
        1200, // loser rating
        50    // loser games
      );

      expect(winnerNewRating).toBeGreaterThan(1200);
      expect(loserNewRating).toBeLessThan(1200);
    });

    it('should give smaller rating change when favorite wins', () => {
      // Stronger player wins
      const { winnerNewRating, loserNewRating } = (db as any).calculateSkillRatingChange(
        1600, // winner rating (higher)
        50,   // winner games
        1200, // loser rating (lower)
        50    // loser games
      );

      const winnerChange = winnerNewRating - 1600;
      const loserChange = 1200 - loserNewRating;

      // Winner gains less than loser loses (expected outcome)
      expect(winnerChange).toBeLessThan(loserChange);
    });

    it('should give larger rating change when underdog wins', () => {
      // Weaker player wins (upset)
      const { winnerNewRating, loserNewRating } = (db as any).calculateSkillRatingChange(
        1200, // winner rating (lower)
        50,   // winner games
        1600, // loser rating (higher)
        50    // loser games
      );

      const winnerChange = winnerNewRating - 1200;
      const loserChange = 1600 - loserNewRating;

      // Winner gains more than loser loses (unexpected outcome)
      expect(winnerChange).toBeGreaterThan(loserChange);
    });

    it('should adjust ratings faster for new players', () => {
      // New player vs veteran
      const { winnerNewRating: newPlayerWinner, loserNewRating: veteranLoser } = (db as any).calculateSkillRatingChange(
        1200, // new player rating
        5,    // new player games (high K-factor)
        1500, // veteran rating
        100   // veteran games (low K-factor)
      );

      const newPlayerChange = newPlayerWinner - 1200;
      const veteranChange = 1500 - veteranLoser;

      // New player's rating changes more
      expect(newPlayerChange).toBeGreaterThan(veteranChange);
    });
  });

  describe('Database Integration', () => {
    it('should initialize players with default rating of 1200', () => {
      const testWallet = 'test_player_1';
      db.ensurePlayer(testWallet);

      const stats = db.getPlayerStats(testWallet);
      expect(stats).toBeDefined();
      expect((stats as any).skill_rating).toBe(1200);
    });

    it('should update skill ratings after a game', () => {
      const winner = 'winner_wallet';
      const loser1 = 'loser_1';
      const loser2 = 'loser_2';

      // Ensure players exist
      [winner, loser1, loser2].forEach(w => db.ensurePlayer(w));

      // Get initial ratings
      const winnerBefore = db.getPlayerStats(winner) as any;
      const loser1Before = db.getPlayerStats(loser1) as any;

      // Record a game result
      db.recordGameResult(
        winner,
        1000000, // 1 SOL prize
        3,
        {
          [winner]: 2,
          [loser1]: 1,
          [loser2]: 0
        }
      );

      // Get updated ratings
      const winnerAfter = db.getPlayerStats(winner) as any;
      const loser1After = db.getPlayerStats(loser1) as any;

      // Winner's rating should increase
      expect(winnerAfter.skill_rating).toBeGreaterThan(winnerBefore.skill_rating);

      // Loser's rating should decrease
      expect(loser1After.skill_rating).toBeLessThan(loser1Before.skill_rating);
    });

    it('should return skill rating leaderboard', () => {
      // Create multiple players with different ratings
      const players = ['p1', 'p2', 'p3', 'p4', 'p5'];
      players.forEach(p => db.ensurePlayer(p));

      // Manually update ratings to create a known ordering
      const updateRating = (wallet: string, rating: number) => {
        (db as any).db.prepare('UPDATE players SET skill_rating = ? WHERE wallet_address = ?').run(rating, wallet);
      };

      updateRating('p1', 1500);
      updateRating('p2', 1800);
      updateRating('p3', 1300);
      updateRating('p4', 1600);
      updateRating('p5', 1400);

      const leaderboard = db.getTopSkillRating(10);

      expect(leaderboard).toBeDefined();
      expect(leaderboard.length).toBe(5);

      // Check ordering (highest first)
      expect(leaderboard[0].wallet_address).toBe('p2');
      expect(leaderboard[0].metric_value).toBe(1800);

      expect(leaderboard[1].wallet_address).toBe('p4');
      expect(leaderboard[1].metric_value).toBe(1600);

      expect(leaderboard[2].wallet_address).toBe('p1');
      expect(leaderboard[2].metric_value).toBe(1500);
    });

    it('should include skill_rating in player stats', () => {
      const wallet = 'test_player_stats';
      db.ensurePlayer(wallet);

      const stats = db.getPlayerStats(wallet);
      expect(stats).toBeDefined();
      expect((stats as any).skill_rating).toBeDefined();
      expect(typeof (stats as any).skill_rating).toBe('number');
    });
  });

  describe('Rating Consistency', () => {
    it('should maintain rating sum approximately constant for equal players', () => {
      // When equal players play, the sum of ratings should stay roughly constant
      // (accounting for rounding differences)
      const { winnerNewRating, loserNewRating } = (db as any).calculateSkillRatingChange(
        1500, 50, 1500, 50
      );

      const sumBefore = 1500 + 1500;
      const sumAfter = winnerNewRating + loserNewRating;

      // Allow small difference due to rounding
      expect(Math.abs(sumAfter - sumBefore)).toBeLessThanOrEqual(2);
    });

    it('should handle multiple sequential games correctly', () => {
      const p1 = 'sequential_p1';
      const p2 = 'sequential_p2';

      db.ensurePlayer(p1);
      db.ensurePlayer(p2);

      const initialRating = 1200;

      // Play 5 games, p1 wins all
      for (let i = 0; i < 5; i++) {
        db.recordGameResult(p1, 0, 2, { [p1]: 1, [p2]: 0 });
      }

      const p1Stats = db.getPlayerStats(p1) as any;
      const p2Stats = db.getPlayerStats(p2) as any;

      // p1 should have gained rating
      expect(p1Stats.skill_rating).toBeGreaterThan(initialRating);

      // p2 should have lost rating
      expect(p2Stats.skill_rating).toBeLessThan(initialRating);

      // Rating gap should be positive
      expect(p1Stats.skill_rating - p2Stats.skill_rating).toBeGreaterThan(0);
    });
  });
});
