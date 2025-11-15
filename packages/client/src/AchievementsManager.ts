/**
 * Achievements Manager
 * Tracks player achievements and unlocks
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  progress: number;
  target: number;
  reward: {
    xp?: number;
    sol?: number;
    skin?: string;
  };
  unlockedAt?: number; // timestamp
}

export class AchievementsManager {
  private achievements: Map<string, Achievement> = new Map();
  private storageKey = 'spermrace_achievements';

  constructor() {
    this.initializeAchievements();
    this.loadProgress();
  }

  /**
   * Define all achievements
   */
  private initializeAchievements() {
    const achievements: Achievement[] = [
      // Easy achievements (everyone gets these)
      {
        id: 'first_timer',
        name: 'First Timer',
        description: 'Play your first game',
        icon: '🎮',
        rarity: 'common',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: { xp: 50 },
      },
      {
        id: 'first_blood',
        name: 'First Blood',
        description: 'Get your first kill',
        icon: '🩸',
        rarity: 'common',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: { xp: 100 },
      },
      {
        id: 'survivor',
        name: 'Survivor',
        description: 'Finish in top 3',
        icon: '🛡️',
        rarity: 'common',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: { xp: 150 },
      },
      {
        id: 'winner',
        name: 'Victory!',
        description: 'Win your first game',
        icon: '🏆',
        rarity: 'common',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: { xp: 200 },
      },

      // Medium achievements (require effort)
      {
        id: 'killer_10',
        name: 'Slayer',
        description: 'Get 10 total kills',
        icon: '⚔️',
        rarity: 'rare',
        unlocked: false,
        progress: 0,
        target: 10,
        reward: { xp: 300 },
      },
      {
        id: 'killer_50',
        name: 'Assassin',
        description: 'Get 50 total kills',
        icon: '🗡️',
        rarity: 'rare',
        unlocked: false,
        progress: 0,
        target: 50,
        reward: { xp: 500 },
      },
      {
        id: 'killer_100',
        name: 'Serial Killer',
        description: 'Get 100 total kills',
        icon: '💀',
        rarity: 'epic',
        unlocked: false,
        progress: 0,
        target: 100,
        reward: { xp: 1000, skin: 'blood_red' },
      },
      {
        id: 'win_5',
        name: 'Champion',
        description: 'Win 5 games',
        icon: '👑',
        rarity: 'rare',
        unlocked: false,
        progress: 0,
        target: 5,
        reward: { xp: 500 },
      },
      {
        id: 'win_streak_3',
        name: 'Hot Streak',
        description: 'Win 3 games in a row',
        icon: '🔥',
        rarity: 'epic',
        unlocked: false,
        progress: 0,
        target: 3,
        reward: { xp: 750 },
      },

      // Hard achievements (mastery)
      {
        id: 'flawless',
        name: 'Flawless Victory',
        description: 'Win without taking damage',
        icon: '✨',
        rarity: 'legendary',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: { xp: 2000, sol: 0.01 },
      },
      {
        id: 'rampage',
        name: 'Rampage',
        description: 'Get 5 kills in one game',
        icon: '💥',
        rarity: 'epic',
        unlocked: false,
        progress: 0,
        target: 5,
        reward: { xp: 1000 },
      },
      {
        id: 'untouchable',
        name: 'Untouchable',
        description: 'Win 10 games in a row',
        icon: '🌟',
        rarity: 'legendary',
        unlocked: false,
        progress: 0,
        target: 10,
        reward: { xp: 5000, sol: 0.05 },
      },

      // Earnings achievements
      {
        id: 'first_earnings',
        name: 'Getting Paid',
        description: 'Earn your first SOL',
        icon: '💰',
        rarity: 'common',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: { xp: 200 },
      },
      {
        id: 'millionaire',
        name: 'Crypto Millionaire',
        description: 'Earn 1 SOL total',
        icon: '💎',
        rarity: 'legendary',
        unlocked: false,
        progress: 0,
        target: 1,
        reward: { xp: 10000, skin: 'diamond_crown' },
      },
    ];

    achievements.forEach(ach => {
      this.achievements.set(ach.id, ach);
    });
  }

  /**
   * Load progress from localStorage
   */
  private loadProgress() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return;

      const data = JSON.parse(saved);
      Object.entries(data).forEach(([id, savedAch]: [string, any]) => {
        const ach = this.achievements.get(id);
        if (ach) {
          ach.unlocked = savedAch.unlocked || false;
          ach.progress = savedAch.progress || 0;
          ach.unlockedAt = savedAch.unlockedAt;
        }
      });
    } catch (err) {
      console.error('[Achievements] Load error:', err);
    }
  }

  /**
   * Save progress to localStorage
   */
  private saveProgress() {
    try {
      const data: any = {};
      this.achievements.forEach((ach, id) => {
        data[id] = {
          unlocked: ach.unlocked,
          progress: ach.progress,
          unlockedAt: ach.unlockedAt,
        };
      });
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.error('[Achievements] Save error:', err);
    }
  }

  /**
   * Update achievement progress
   * Returns true if achievement was unlocked
   */
  updateProgress(id: string, value: number): boolean {
    const ach = this.achievements.get(id);
    if (!ach || ach.unlocked) return false;

    ach.progress = Math.min(value, ach.target);

    if (ach.progress >= ach.target) {
      ach.unlocked = true;
      ach.unlockedAt = Date.now();
      this.saveProgress();
      return true;
    }

    this.saveProgress();
    return false;
  }

  /**
   * Increment achievement progress
   */
  incrementProgress(id: string, amount: number = 1): boolean {
    const ach = this.achievements.get(id);
    if (!ach || ach.unlocked) return false;

    return this.updateProgress(id, ach.progress + amount);
  }

  /**
   * Check multiple achievements at once
   */
  checkAchievements(stats: {
    totalGames?: number;
    totalKills?: number;
    wins?: number;
    winStreak?: number;
    totalEarnings?: number;
    gameKills?: number;
  }): Achievement[] {
    const unlocked: Achievement[] = [];

    // Check each achievement
    if (stats.totalGames !== undefined) {
      if (this.incrementProgress('first_timer', stats.totalGames)) {
        unlocked.push(this.achievements.get('first_timer')!);
      }
    }

    if (stats.totalKills !== undefined) {
      if (this.updateProgress('first_blood', stats.totalKills)) {
        unlocked.push(this.achievements.get('first_blood')!);
      }
      if (this.updateProgress('killer_10', stats.totalKills)) {
        unlocked.push(this.achievements.get('killer_10')!);
      }
      if (this.updateProgress('killer_50', stats.totalKills)) {
        unlocked.push(this.achievements.get('killer_50')!);
      }
      if (this.updateProgress('killer_100', stats.totalKills)) {
        unlocked.push(this.achievements.get('killer_100')!);
      }
    }

    if (stats.wins !== undefined) {
      if (this.updateProgress('winner', stats.wins)) {
        unlocked.push(this.achievements.get('winner')!);
      }
      if (this.updateProgress('win_5', stats.wins)) {
        unlocked.push(this.achievements.get('win_5')!);
      }
    }

    if (stats.winStreak !== undefined) {
      if (this.updateProgress('win_streak_3', stats.winStreak)) {
        unlocked.push(this.achievements.get('win_streak_3')!);
      }
      if (this.updateProgress('untouchable', stats.winStreak)) {
        unlocked.push(this.achievements.get('untouchable')!);
      }
    }

    if (stats.totalEarnings !== undefined) {
      if (stats.totalEarnings > 0 && this.incrementProgress('first_earnings', 1)) {
        unlocked.push(this.achievements.get('first_earnings')!);
      }
      if (this.updateProgress('millionaire', stats.totalEarnings)) {
        unlocked.push(this.achievements.get('millionaire')!);
      }
    }

    if (stats.gameKills !== undefined) {
      if (this.updateProgress('rampage', stats.gameKills)) {
        unlocked.push(this.achievements.get('rampage')!);
      }
    }

    return unlocked;
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  /**
   * Get unlocked achievements
   */
  getUnlocked(): Achievement[] {
    return this.getAllAchievements().filter(a => a.unlocked);
  }

  /**
   * Get achievement by ID
   */
  getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  /**
   * Get completion percentage
   */
  getCompletionPercentage(): number {
    const total = this.achievements.size;
    const unlocked = this.getUnlocked().length;
    return Math.round((unlocked / total) * 100);
  }
}

export default AchievementsManager;
