/**
 * Combat Feedback System
 * Provides satisfying feedback for kills, deaths, and combat events
 * Makes combat feel impactful and rewarding
 */

import { System, SystemPriority } from '../core/System';
import type { Health } from '../components/Health';
import { addKill } from '../components/Health';
import type { Boost } from '../components/Boost';
import { setBoostEnergy } from '../components/Boost';
import type { Player } from '../components/Player';
import type { Position } from '../components/Position';
import type { KillPower } from '../components/KillPower';
import { activateKillPower } from '../components/KillPower';
import { ComponentNames, createComponentMask } from '../components';
import { BOOST_CONFIG } from '../config';
import type { FloatingTextSystem } from './FloatingTextSystem';

/**
 * Combat feedback event
 */
export interface CombatEvent {
  /** Event type */
  type: 'kill' | 'death' | 'kill_streak' | 'near_miss';

  /** Victim ID */
  victimId: string;

  /** Killer ID */
  killerId: string;

  /** Victim name */
  victimName: string;

  /** Killer name */
  killerName: string;

  /** Kill streak count (if applicable) */
  streak?: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Screenshake config
 */
export interface ScreenshakeConfig {
  /** Intensity (pixels) */
  intensity: number;

  /** Duration (ms) */
  duration: number;

  /** Decay factor */
  decay: number;
}

/**
 * Combat feedback system configuration
 */
export interface CombatFeedbackConfig {
  /** Enable/disable sound effects */
  enableSound: boolean;

  /** Enable/disable screenshake */
  enableScreenshake: boolean;

  /** Enable/disable kill streaks */
  enableKillStreaks: boolean;

  /** Screenshake intensity for kills */
  killShakeIntensity: number;

  /** Screenshake intensity for deaths */
  deathShakeIntensity: number;
}

/**
 * Kill streak tier
 */
interface KillStreakTier {
  /** Minimum kills */
  minKills: number;

  /** Display name */
  name: string;

  /** Color (hex) */
  color: number;

  /** Sound pitch multiplier */
  pitch: number;

  /** Screenshake intensity */
  shakeIntensity: number;
}

/**
 * Combat feedback system
 * Handles all combat-related feedback (screenshake, sounds, kill streaks)
 */
export class CombatFeedbackSystem extends System {
  public readonly priority = SystemPriority.UI;

  private readonly _config: CombatFeedbackConfig;
  private readonly _events: CombatEvent[] = [];

  // Kill streak tracking
  private readonly _killStreaks: Map<string, number> = new Map();
  private readonly _lastKillTime: Map<string, number> = new Map();

  // Screenshake state
  private _screenshake: ScreenshakeConfig | null = null;
  private _shakeOffset = { x: 0, y: 0 };
  private _shakeTime = 0;

  // Sound state
  private _audioContext: AudioContext | null = null;

  // Kill streak tiers
  private readonly _streakTiers: KillStreakTier[] = [
    { minKills: 2, name: 'DOUBLE KILL!', color: 0x22d3ee, pitch: 1.0, shakeIntensity: 3 },
    { minKills: 3, name: 'TRIPLE KILL!', color: 0x00ff88, pitch: 1.2, shakeIntensity: 5 },
    { minKills: 5, name: 'MEGA KILL!', color: 0xff6b6b, pitch: 1.4, shakeIntensity: 7 },
    { minKills: 7, name: 'ULTRA KILL!', color: 0xff00ff, pitch: 1.6, shakeIntensity: 10 },
    { minKills: 10, name: 'GODLIKE!', color: 0xffd700, pitch: 1.8, shakeIntensity: 15 },
  ];

  // Component mask
  private readonly _healthPlayerMask: number;

  constructor(config: Partial<CombatFeedbackConfig> = {}) {
    super(SystemPriority.UI);

    this._config = {
      enableSound: config.enableSound ?? true,
      enableScreenshake: config.enableScreenshake ?? true,
      enableKillStreaks: config.enableKillStreaks ?? true,
      killShakeIntensity: config.killShakeIntensity ?? 5,
      deathShakeIntensity: config.deathShakeIntensity ?? 8,
    };

    this._healthPlayerMask = createComponentMask(
      ComponentNames.HEALTH,
      ComponentNames.PLAYER
    );
  }

  /**
   * Update screenshake and check for combat events
   */
  update(dt: number): void {
    // Update screenshake
    this._updateScreenshake(dt);

    // Check for new deaths/kills
    this._checkCombatEvents();
  }

  /**
   * Check for combat events from entity health states
   */
  private _checkCombatEvents(): void {
    const entities = this.entityManager.queryByMask(this._healthPlayerMask);

    for (const entity of entities) {
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);

      if (!health || !player) continue;

      // Check if entity just died
      if (!health.isAlive && health.wasAlive) {
        const killerId = health.killerId;

        const isEntityKiller = !!killerId && killerId !== 'zone' && killerId !== 'trap' && killerId !== 'powerup';

        if (isEntityKiller) {
          // This is a kill - track streaks
          this._handleKill(killerId as string, entity.id, player.name);
        } else {
          // Died without killer (zone, self-collision, etc)
          this._handleDeath(entity.id, player.name, killerId);
        }

        // Update wasAlive flag
        health.wasAlive = false;
      } else if (health.isAlive && !health.wasAlive) {
        // Respawned
        health.wasAlive = true;
        this._killStreaks.delete(entity.id);
        this._lastKillTime.delete(entity.id);
      }
    }
  }

  /**
   * Handle a kill event
   */
  private _handleKill(killerId: string, victimId: string, victimName: string): void {
    const now = Date.now();
    const STREAK_WINDOW = 5000; // 5 seconds between kills for streak

    // Get killer info
    const killerEntity = this.entityManager.getEntity(killerId);
    const killerPlayer = killerEntity?.getComponent<Player>(ComponentNames.PLAYER);
    const killerName = killerPlayer?.name ?? 'Unknown';

    // Get victim info for floating text position
    const victimEntity = this.entityManager.getEntity(victimId);
    const victimPos = victimEntity?.getComponent<Position>(ComponentNames.POSITION);

    // Core loop reward: every confirmed kill grants score + instant boost + kill power.
    const killerHealth = killerEntity?.getComponent<Health>(ComponentNames.HEALTH);
    if (killerHealth) {
      addKill(killerHealth);
    }

    const killerBoost = killerEntity?.getComponent<Boost>(ComponentNames.BOOST);
    if (killerBoost) {
      setBoostEnergy(killerBoost, killerBoost.energy + BOOST_CONFIG.KILL_REWARD_ENERGY);
    }

    // Activate kill power (speed burst + body growth)
    const killerKillPower = killerEntity?.getComponent<KillPower>(ComponentNames.KILL_POWER);
    if (killerKillPower) {
      activateKillPower(killerKillPower, now);
    }

    // Spawn "ELIMINATED!" floating text at victim location
    if (victimPos) {
      const floatingText = this._getFloatingTextSystem();
      if (floatingText) {
        // Main elimination text
        floatingText.spawnText(
          victimPos.x,
          victimPos.y - 30,
          `ELIMINATED ${victimName.toUpperCase()}!`,
          '#FF4444',
          { fontSize: 28, speed: 40, lifetime: 1.5 }
        );
      }
    }

    // Update kill streak
    let streak = 0;
    const lastKill = this._lastKillTime.get(killerId) ?? 0;

    if (now - lastKill < STREAK_WINDOW) {
      streak = (this._killStreaks.get(killerId) ?? 0) + 1;
    } else {
      streak = 1;
    }

    this._killStreaks.set(killerId, streak);
    this._lastKillTime.set(killerId, now);

    // Determine kill streak tier
    const tier = this._streakTiers
      .filter(t => streak >= t.minKills)
      .sort((a, b) => b.minKills - a.minKills)[0];

    // Create combat event
    const event: CombatEvent = {
      type: tier ? 'kill_streak' : 'kill',
      victimId,
      killerId,
      victimName,
      killerName,
      streak: tier ? streak : undefined,
      timestamp: now,
    };

    this._events.push(event);

    // Apply feedback
    if (this._config.enableScreenshake) {
      const intensity = tier
        ? tier.shakeIntensity
        : this._config.killShakeIntensity;

      this._triggerScreenshake({
        intensity,
        duration: 300,
        decay: 0.9,
      });
    }

    if (this._config.enableSound) {
      this._playKillSound(streak);
    }
  }

  /**
   * Handle a death event
   */
  private _handleDeath(victimId: string, victimName: string, killerId: string | null): void {
    const event: CombatEvent = {
      type: 'death',
      victimId,
      killerId: killerId ?? 'unknown',
      victimName,
      killerName: killerId ?? 'Unknown',
      timestamp: Date.now(),
    };

    this._events.push(event);

    // Reset streak
    this._killStreaks.delete(victimId);
    this._lastKillTime.delete(victimId);

    // Apply death feedback
    if (this._config.enableScreenshake) {
      this._triggerScreenshake({
        intensity: this._config.deathShakeIntensity,
        duration: 500,
        decay: 0.85,
      });
    }

    if (this._config.enableSound) {
      this._playDeathSound();
    }
  }

  /**
   * Update screenshake effect
   */
  private _updateScreenshake(dt: number): void {
    if (!this._screenshake) {
      this._shakeOffset = { x: 0, y: 0 };
      return;
    }

    this._shakeTime += dt * 1000;

    // Random shake with decay
    const intensity = this._screenshake.intensity * Math.pow(this._screenshake.decay, this._shakeTime / 100);
    this._shakeOffset = {
      x: (Math.random() - 0.5) * intensity * 2,
      y: (Math.random() - 0.5) * intensity * 2,
    };

    // End shake after duration
    if (this._shakeTime >= this._screenshake.duration) {
      this._screenshake = null;
      this._shakeOffset = { x: 0, y: 0 };
    }
  }

  /**
   * Trigger screenshake effect
   */
  private _triggerScreenshake(config: ScreenshakeConfig): void {
    this._screenshake = config;
    this._shakeTime = 0;
  }

  /**
   * Play kill sound with pitch variation based on streak
   */
  private _playKillSound(streak: number): void {
    if (!this._config.enableSound) return;

    try {
      // Initialize audio context on first use
      if (!this._audioContext) {
        this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const tier = this._streakTiers
        .filter(t => streak >= t.minKills)
        .sort((a, b) => b.minKills - a.minKills)[0];

      const pitch = tier?.pitch ?? 1.0;

      // Create oscillator for kill sound
      const oscillator = this._audioContext.createOscillator();
      const gainNode = this._audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this._audioContext.destination);

      // Sound design: ascending ping for kills
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800 * pitch, this._audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200 * pitch, this._audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, this._audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this._audioContext.currentTime + 0.15);

      oscillator.start(this._audioContext.currentTime);
      oscillator.stop(this._audioContext.currentTime + 0.15);
    } catch (error) {
      console.warn('[CombatFeedbackSystem] Failed to play kill sound:', error);
    }
  }

  /**
   * Get floating text system via engine
   */
  private _getFloatingTextSystem(): FloatingTextSystem | null {
    const engine = this.getEngine();
    return engine?.getSystemManager()?.getSystem<FloatingTextSystem>('floatingText') ?? null;
  }

  /**
   * Play death sound
   */
  private _playDeathSound(): void {
    if (!this._config.enableSound) return;

    try {
      if (!this._audioContext) {
        this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Create oscillator for death sound
      const oscillator = this._audioContext.createOscillator();
      const gainNode = this._audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this._audioContext.destination);

      // Sound design: descending boom for deaths
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(200, this._audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, this._audioContext.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0.4, this._audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this._audioContext.currentTime + 0.3);

      oscillator.start(this._audioContext.currentTime);
      oscillator.stop(this._audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('[CombatFeedbackSystem] Failed to play death sound:', error);
    }
  }

  /**
   * Get all combat events since last check
   */
  getEvents(): ReadonlyArray<CombatEvent> {
    return [...this._events];
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this._events.length = 0;
  }

  /**
   * Get current screenshake offset
   */
  getScreenshakeOffset(): { x: number; y: number } {
    return { ...this._shakeOffset };
  }

  /**
   * Get kill streak for player
   */
  getKillStreak(playerId: string): number {
    return this._killStreaks.get(playerId) ?? 0;
  }

  /**
   * Get kill streak tier for display
   */
  getKillStreakTier(playerId: string): KillStreakTier | null {
    const streak = this.getKillStreak(playerId);
    if (streak === 0) return null;

    return this._streakTiers
      .filter(t => streak >= t.minKills)
      .sort((a, b) => b.minKills - a.minKills)[0] ?? null;
  }

  /**
   * Destroy system
   */
  destroy(): void {
    this._audioContext?.close();
    this._audioContext = null;
    this._events.length = 0;
    this._killStreaks.clear();
    this._lastKillTime.clear();
  }
}

/**
 * Factory function
 */
export function createCombatFeedbackSystem(
  config?: Partial<CombatFeedbackConfig>
): CombatFeedbackSystem {
  return new CombatFeedbackSystem(config);
}
