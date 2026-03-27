/**
 * Death Effect System
 * Handles all death-related visual and audio effects:
 * - Explosion particles
 * - Camera shake
 * - Haptic feedback
 * - Sound effects
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Health } from '../components/Health';
import { EntityState } from '../components/Health';
import type { Player } from '../components/Player';
import { ComponentNames, createComponentMask } from '../components';
import { CameraSystem } from './CameraSystem';
import { RenderSystem } from './RenderSystem';
import { CollisionSystem } from './CollisionSystem';
import type { CollisionResult } from './CollisionSystem';
import { FloatingTextSystem } from './FloatingTextSystem';
import type { SlowMotionSystem } from './SlowMotionSystem';

/**
 * Death effect configuration
 */
export interface DeathEffectConfig {
  /** Camera shake intensity (0-1) */
  cameraShakeIntensity: number;

  /** Camera shake duration (seconds) */
  cameraShakeDuration: number;

  /** Haptic feedback type */
  hapticType: 'light' | 'medium' | 'heavy';

  /** Explosion particle count multiplier */
  explosionMultiplier: number;
}

/**
 * Death event data
 */
export interface DeathEvent {
  /** Victim entity ID */
  victimId: string;

  /** Killer entity ID (null for zone/self) */
  killerId: string | null;

  /** Death position */
  x: number;

  /** Death position */
  y: number;

  /** Victim color for particles */
  color: number;

  /** Death type */
  type: 'trail' | 'zone' | 'trap' | 'car';

  /** Timestamp */
  timestamp: number;
}

/**
 * Death effect system
 * Monitors health state changes and triggers effects
 */
export class DeathEffectSystem extends System {
  public readonly priority = SystemPriority.AI - 1; // Run after AI, before effects

  private readonly _camera: CameraSystem | null = null;
  /** @internal Allow Game to set renderer after creation */
  public _renderer: RenderSystem | null = null;
  private readonly _collision: CollisionSystem | null = null;
  private readonly _floatingText: FloatingTextSystem | null = null;

  // Track entity states to detect deaths
  private readonly _entityStates: Map<string, EntityState> = new Map();

  // Component masks
  private readonly _mask: number;

  // Audio manager reference
  private readonly _audioManager: any = null;

  // Slow motion system for final kill effect
  private _slowMotion: SlowMotionSystem | null = null;

  // Victory state tracking
  private _victoryTriggered: boolean = false;

  constructor(
    cameraSystem: CameraSystem | null = null,
    renderSystem: RenderSystem | null = null,
    collisionSystem: CollisionSystem | null = null,
    audioManager: any = null,
    floatingTextSystem: FloatingTextSystem | null = null
  ) {
    super(SystemPriority.EFFECTS);

    this._camera = cameraSystem;
    this._renderer = renderSystem;
    this._collision = collisionSystem;
    this._audioManager = audioManager;
    this._floatingText = floatingTextSystem;

    this._mask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.HEALTH,
      ComponentNames.PLAYER
    );
  }

  /**
   * Update and check for deaths
   */
  update(dt: number): void {
    const entities = this.entityManager.queryByMask(this._mask);

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);

      if (!position || !health || !player) continue;

      const previousState = this._entityStates.get(entity.id);

      // Store current state for next frame
      this._entityStates.set(entity.id, health.state);

      // Check if just died (transitioned from ALIVE/SPAWNING to DYING)
      if (previousState === EntityState.ALIVE && health.state === EntityState.DYING) {
        this._handleDeath(entity.id, position.x, position.y, player.color, health.killerId);
      }

      // Check if transitioned from DYING to DEAD (for cleanup)
      if (previousState === EntityState.DYING && health.state === EntityState.DEAD) {
        this._handleCleanup(entity.id);
      }

      // Check if spawned (transitioned from SPAWNING to ALIVE)
      if (previousState === EntityState.SPAWNING && health.state === EntityState.ALIVE) {
        this._handleSpawn(entity.id, position.x, position.y, player.color);
      }
    }

    // Clean up stale state entries
    this._cleanupStaleStates(entities);
  }

  /**
   * Handle entity death
   */
  private _handleDeath(
    entityId: string,
    x: number,
    y: number,
    color: number,
    killerId: string | null
  ): void {
    // Determine death type
    let deathType: 'trail' | 'zone' | 'trap' | 'car' = 'trail';
    if (killerId === 'zone') {
      deathType = 'zone';
    } else if (killerId === 'trap') {
      deathType = 'trap';
    }

    // Trigger death burst particles
    if (this._renderer) {
      this._renderer.spawnDeathBurst(x, y, color);
      if (killerId && killerId !== 'zone' && killerId !== 'trap') {
        this._renderer.spawnHitCross(x, y, 0x22d3ee);
      }

      // Spawn DNA loot orbs that scatter outward
      this._spawnDNALoot(x, y, color);
    }

    // Camera shake
    if (this._camera) {
      this._camera.shake(0.5, 0.4); // intensity, duration
    }

    // Floating text
    if (this._floatingText) {
      if (killerId && killerId !== 'zone' && killerId !== 'trap') {
        // Killed by another player
        this._floatingText.spawnText(x, y - 50, '✚ HIT', '#67e8f9', { fontSize: 20, speed: 56, lifetime: 1.0 });
        this._floatingText.spawnText(x, y - 20, '+100', '#FFD700', { fontSize: 32, speed: 80 });
      } else {
        // Environmental death
        this._floatingText.spawnText(x, y - 20, 'WASTED', '#FF0000', { fontSize: 24, speed: 40 });
      }
    }

    // Haptic feedback
    this._triggerHaptic('heavy');

    // Note: kill/death sounds are handled by CombatFeedbackSystem to avoid duplicates.
    // Spawn/pickup sounds are still handled via _audioManager.

    // Check for final kill (victory condition)
    // We check after the current death is registered, so aliveCount === 1 means one winner
    const aliveCount = this._countAliveEntities();
    if (aliveCount === 1 && !this._victoryTriggered) {
      this._victoryTriggered = true;
      const winner = this._findWinner();
      if (winner) {
        // Delay victory celebration slightly for dramatic effect
        setTimeout(() => {
          this._handleVictory(winner);
        }, 200);
      }
    }
  }

  /**
   * Spawn DNA loot orbs that scatter outward from death position
   */
  private _spawnDNALoot(x: number, y: number, color: number): void {
    if (!this._renderer) return;

    const particlePool = this._renderer.getParticlePool();
    if (!particlePool) return;

    // Spawn 5-10 DNA orbs that scatter outward
    const count = 5 + Math.floor(Math.random() * 6);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 60;
      const dist = 10 + Math.random() * 20;

      particlePool.spawn({
        type: 2 as any, // ParticleType.SPARK
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.5 + Math.random() * 0.5,
        decay: 0.8,
        startSize: 6,
        endSize: 2,
        size: 6,
        color: color,
        alpha: 0.9,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 4,
        gravity: 20, // Slight downward pull
        active: true,
      });
    }
  }

  /**
   * Handle entity spawn
   */
  private _handleSpawn(entityId: string, x: number, y: number, color: number): void {
    // Trigger spawn effect
    if (this._renderer) {
      this._renderer.spawnSpawnEffect(x, y, color);
    }

    // Floating text
    if (this._floatingText) {
      this._floatingText.spawnText(x, y - 30, 'READY!', '#00FF00', { fontSize: 24, speed: 60, lifetime: 1.0 });
    }

    // Haptic feedback (light)
    this._triggerHaptic('light');

    // Sound effect
    if (this._audioManager && this._audioManager.playPickup) {
      this._audioManager.playPickup();
    }
  }

  /**
   * Handle entity cleanup (after death animation)
   */
  private _handleCleanup(entityId: string): void {
    // Remove from state tracking
    this._entityStates.delete(entityId);
  }

  /**
   * Trigger haptic feedback
   */
  private _triggerHaptic(type: 'light' | 'medium' | 'heavy'): void {
    try {
      if (!navigator.vibrate) return;

      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(30);
          break;
        case 'heavy':
          navigator.vibrate([50, 30, 50]);
          break;
      }
    } catch (e) {
      // Ignore haptic errors
    }
  }

  /**
   * Clean up state entries for entities that no longer exist
   */
  private _cleanupStaleStates(entities: unknown[]): void {
    const activeIds = new Set(entities.map((e: any) => e.id));

    for (const entityId of this._entityStates.keys()) {
      if (!activeIds.has(entityId)) {
        this._entityStates.delete(entityId);
      }
    }
  }

  /**
   * Manually trigger a death effect (for testing or external events)
   */
  triggerDeathEffect(x: number, y: number, color: number, config?: Partial<DeathEffectConfig>): void {
    // Particles
    if (this._renderer) {
      const count = config?.explosionMultiplier ? 30 * config.explosionMultiplier : 30;
      this._renderer.spawnExplosion(x, y, color, count);
    }

    // Camera shake
    if (this._camera) {
      const intensity = config?.cameraShakeIntensity ?? 0.5;
      const duration = config?.cameraShakeDuration ?? 0.4;
      this._camera.shake(intensity, duration);
    }

    // Haptic
    const hapticType = config?.hapticType ?? 'heavy';
    this._triggerHaptic(hapticType);
  }

  /**
   * Manually trigger a spawn effect
   */
  triggerSpawnEffect(x: number, y: number, color: number): void {
    if (this._renderer) {
      this._renderer.spawnSpawnEffect(x, y, color);
    }
    this._triggerHaptic('light');
  }

  /**
   * Trigger boost exhaust effect
   */
  triggerBoostExhaust(x: number, y: number, angle: number, color: number): void {
    if (this._renderer) {
      this._renderer.spawnExhaust(x, y, angle, color);
    }
  }

  /**
   * Get death event listener (for external integration)
   */
  onDeath(callback: (event: DeathEvent) => void): void {
    // This would be used by UI systems to show death screens, etc.
    // Store callback and call it in _handleDeath
  }

  /**
   * Set audio manager
   */
  setAudioManager(audioManager: any): void {
    (this as any)._audioManager = audioManager;
  }

  /**
   * Set slow motion system
   */
  setSlowMotionSystem(slowMotion: SlowMotionSystem): void {
    this._slowMotion = slowMotion;
  }

  /**
   * Count alive entities
   */
  private _countAliveEntities(): number {
    const entities = this.entityManager.queryByMask(this._mask);
    let count = 0;
    for (const entity of entities) {
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      if (health && health.state === EntityState.ALIVE) {
        count++;
      }
    }
    return count;
  }

  /**
   * Find the last alive entity (the winner)
   */
  private _findWinner(): { id: string; x: number; y: number; color: number } | null {
    const entities = this.entityManager.queryByMask(this._mask);
    for (const entity of entities) {
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      if (health && health.state === EntityState.ALIVE) {
        const position = entity.getComponent<Position>(ComponentNames.POSITION);
        const player = entity.getComponent<Player>(ComponentNames.PLAYER);
        if (position && player) {
          return { id: entity.id, x: position.x, y: position.y, color: player.color };
        }
      }
    }
    return null;
  }

  /**
   * Find the local player entity
   */
  private _findLocalPlayer(): any {
    const entities = this.entityManager.queryByMask(this._mask);
    for (const entity of entities) {
      const player = entity.getComponent<any>(ComponentNames.PLAYER);
      if (player?.isLocal) return entity;
    }
    return null;
  }

  /**
   * Handle victory celebration
   */
  private _handleVictory(winner: { id: string; x: number; y: number; color: number }): void {
    // Trigger slow-mo for dramatic effect
    if (this._slowMotion) {
      this._slowMotion.trigger(0.25, 1500); // 0.25x speed for 1.5 seconds
    }

    // Mega particle burst (golden)
    if (this._renderer) {
      this._renderer.spawnExplosion(winner.x, winner.y, 0xFFD700, 60); // Gold explosion
      this._renderer.spawnExplosion(winner.x, winner.y, winner.color, 40); // Player color burst
    }

    // Victory floating text
    if (this._floatingText) {
      this._floatingText.spawnText(winner.x, winner.y - 80, '👑 VICTORY! 👑', '#FFD700', {
        fontSize: 48,
        speed: 20,
        lifetime: 3.0,
      });
      this._floatingText.spawnText(winner.x, winner.y - 40, '#1', '#FFFFFF', {
        fontSize: 32,
        speed: 30,
        lifetime: 2.5,
      });
    }

    // Camera zoom in on winner
    if (this._camera) {
      this._camera.setTarget(winner.id);
      this._camera.setZoom(1.5);
      this._camera.shake(0.3, 0.5); // Celebratory shake
    }

    // Heavy haptic feedback
    this._triggerHaptic('heavy');

    // Victory sound
    if (this._audioManager && this._audioManager.playVictory) {
      this._audioManager.playVictory();
    }
  }

  /**
   * Reset victory state (for new round)
   */
  resetVictory(): void {
    this._victoryTriggered = false;
  }
}

/**
 * Factory function
 */
export function createDeathEffectSystem(
  cameraSystem?: CameraSystem,
  renderSystem?: RenderSystem,
  collisionSystem?: CollisionSystem,
  audioManager?: any,
  floatingTextSystem?: FloatingTextSystem
): DeathEffectSystem {
  return new DeathEffectSystem(cameraSystem, renderSystem, collisionSystem, audioManager, floatingTextSystem);
}

// Re-export EntityState for convenience
export { EntityState } from '../components/Health';
