/**
 * Zone System
 * Manages the shrinking arena zone (battle royale mechanic)
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Health } from '../components/Health';
import { killEntity } from '../components/Health';
import { ComponentNames, createComponentMask } from '../components';
import { MATCH_CONFIG } from '../config/GameConstants';

/**
 * Zone state
 */
export enum ZoneState {
  /** Zone not started */
  IDLE = 'idle',

  /** Zone warning phase (about to start shrinking) */
  WARNING = 'warning',

  /** Zone shrinking */
  SHRINKING = 'shrinking',

  /** Zone at minimum size */
  FINAL = 'final',
}

/**
 * Zone configuration
 */
export interface ZoneConfig {
  /** Initial delay before zone starts shrinking (ms) */
  startDelayMs: number;

  /** Warning duration before shrink starts (ms) */
  warningDurationMs: number;

  /** Duration of full shrink (ms) */
  shrinkDurationMs: number;

  /** Minimum zone size (pixels) */
  minSize: number;

  /** Shrink speed (pixels/second) */
  shrinkSpeed: number;

  /** Center X of arena */
  centerX: number;

  /** Center Y of arena */
  centerY: number;
}

/**
 * Zone system for battle royale arena shrinking
 */
export class ZoneSystem extends System {
  public readonly priority = SystemPriority.ZONE;

  private _state: ZoneState = ZoneState.IDLE;
  private _config: ZoneConfig;
  private _currentRadius: number;
  private _targetRadius: number;
  private _stateStartTime: number = 0;
  private _elapsedTime: number = 0;

  // Component masks
  private readonly _positionHealthMask: number;

  constructor(config?: Partial<ZoneConfig>) {
    super(SystemPriority.ZONE);

    this._positionHealthMask = createComponentMask(ComponentNames.POSITION, ComponentNames.HEALTH);

    // Default configuration — mirrors MATCH_CONFIG so standalone use is safe
    this._config = {
      startDelayMs: config?.startDelayMs ?? MATCH_CONFIG.ZONE_START_DELAY_MS,
      warningDurationMs: config?.warningDurationMs ?? MATCH_CONFIG.ZONE_WARNING_DURATION_MS,
      shrinkDurationMs: config?.shrinkDurationMs ?? MATCH_CONFIG.ZONE_SHRINK_DURATION_MS,
      minSize: config?.minSize ?? MATCH_CONFIG.ZONE_MIN_SIZE,
      shrinkSpeed: config?.shrinkSpeed ?? MATCH_CONFIG.ZONE_SHRINK_RATE,
      centerX: config?.centerX ?? 1750,
      centerY: config?.centerY ?? 1250,
    };

    // Start with radius large enough to cover ALL arena corners from center.
    // Math.max(cx, cy) only reaches the nearest axis-aligned edge, leaving
    // diagonal corners (distance = sqrt(cx²+cy²)) outside the initial zone.
    this._currentRadius = Math.hypot(this._config.centerX, this._config.centerY);
    this._targetRadius = this._currentRadius;
  }

  /**
   * Initialize zone
   */
  init(): void {
    this.reset();
  }

  /**
   * Update zone state and check for players outside
   */
  update(dt: number): void {
    this._elapsedTime += dt * 1000; // Convert to ms, accumulate

    switch (this._state) {
      case ZoneState.IDLE:
        if (this._elapsedTime >= this._config.startDelayMs) {
          this._transitionTo(ZoneState.WARNING);
        }
        break;

      case ZoneState.WARNING:
        if (this._elapsedTime >= this._config.startDelayMs + this._config.warningDurationMs) {
          this._transitionTo(ZoneState.SHRINKING);
          this._updateShrink(this._elapsedTime); // Update radius immediately
        }
        break;

      case ZoneState.SHRINKING: {
        this._updateShrink(this._elapsedTime);
        if (this._elapsedTime >= this._config.startDelayMs + this._config.warningDurationMs + this._config.shrinkDurationMs) {
          this._transitionTo(ZoneState.FINAL);
        }
        break;
      }

      case ZoneState.FINAL:
        // Stay at final size
        break;
    }

    // Check for players outside zone
    this._checkZoneCollisions();
  }

  /**
   * Helper to update shrink radius based on current time
   */
  private _updateShrink(timeMs: number): void {
    const shrinkStartMs = this._config.startDelayMs + this._config.warningDurationMs;
    const elapsedInShrink = timeMs - shrinkStartMs;
    const progress = Math.min(1, Math.max(0, elapsedInShrink / this._config.shrinkDurationMs));

    // Shrink from initial towards target (minSize / 2)
    const initialRadius = Math.hypot(this._config.centerX, this._config.centerY);
    const targetRadius = this._config.minSize / 2;
    
    this._currentRadius = initialRadius + (targetRadius - initialRadius) * progress;
  }

  /**
   * Start the zone sequence
   */
  start(): void {
    this._stateStartTime = this._elapsedTime;
    this._state = ZoneState.IDLE;
  }

  /**
   * Reset zone to initial state
   */
  reset(): void {
    this._state = ZoneState.IDLE;
    this._currentRadius = Math.hypot(this._config.centerX, this._config.centerY);
    this._targetRadius = this._currentRadius;
    this._stateStartTime = 0;
    this._elapsedTime = 0; // Reset accumulator
  }

  /**
   * Get current zone state
   */
  getState(): ZoneState {
    return this._state;
  }

  /**
   * Get current zone radius
   */
  getCurrentRadius(): number {
    return this._currentRadius;
  }

  /**
   * Get target zone radius
   */
  getTargetRadius(): number {
    return this._targetRadius;
  }

  /**
   * Get zone center
   */
  getCenter(): { x: number; y: number } {
    return {
      x: this._config.centerX,
      y: this._config.centerY,
    };
  }

  /**
   * Get time until next shrink phase (ms)
   */
  getTimeUntilNextPhase(): number {
    switch (this._state) {
      case ZoneState.IDLE:
        return Math.max(0, this._config.startDelayMs - this._elapsedTime);

      case ZoneState.WARNING:
        return Math.max(0, this._config.warningDurationMs - (this._elapsedTime - this._stateStartTime));

      case ZoneState.SHRINKING:
        const remainingRadius = this._currentRadius - this._config.minSize / 2;
        return Math.max(0, (remainingRadius / this._config.shrinkSpeed) * 1000);

      default:
        return 0;
    }
  }

  /**
   * Check if a point is inside the zone
   */
  isInsideZone(x: number, y: number, margin: number = 0): boolean {
    const dx = x - this._config.centerX;
    const dy = y - this._config.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= this._currentRadius - margin;
  }

  /**
   * Get distance from zone edge for a position (negative = outside)
   */
  getDistanceFromZone(x: number, y: number): number {
    const dx = x - this._config.centerX;
    const dy = y - this._config.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return this._currentRadius - dist;
  }

  /**
   * Check for players outside zone and eliminate them
   */
  private _checkZoneCollisions(): void {
    if (this._state === ZoneState.IDLE || this._state === ZoneState.WARNING) {
      return; // No damage during warning phase
    }

    const entities = this.entityManager.queryByMask(this._positionHealthMask);

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);

      if (!position || !health || !health.isAlive) continue;

      // Check if outside zone (with small grace margin)
      const distanceFromZone = this.getDistanceFromZone(position.x, position.y);

      if (distanceFromZone < -50) {
        // Player is significantly outside zone - eliminate
        killEntity(health, 'zone', false);
      }
    }
  }

  /**
   * Transition to new state
   */
  private _transitionTo(state: ZoneState): void {
    this._state = state;
    this._stateStartTime = this._elapsedTime;

    // Set target radius based on state
    if (state === ZoneState.SHRINKING) {
      this._targetRadius = this._config.minSize / 2;
    }
  }

  /**
   * Update zone configuration
   */
  updateConfig(config: Partial<ZoneConfig>): void {
    this._config = { ...this._config, ...config };
  }

  /**
   * Set arena center
   */
  setCenter(x: number, y: number): void {
    this._config.centerX = x;
    this._config.centerY = y;
  }

  /**
   * Set arena size (recalculates initial radius)
   */
  setArenaSize(width: number, height: number): void {
    this._config.centerX = width / 2;
    this._config.centerY = height / 2;
    if (this._state === ZoneState.IDLE) {
      this._currentRadius = Math.hypot(width / 2, height / 2);
    }
  }

  /**
   * Get zone debug info
   */
  getDebugInfo(): {
    state: ZoneState;
    currentRadius: number;
    targetRadius: number;
    center: { x: number; y: number };
    timeUntilNextPhase: number;
  } {
    return {
      state: this._state,
      currentRadius: this._currentRadius,
      targetRadius: this._targetRadius,
      center: this.getCenter(),
      timeUntilNextPhase: this.getTimeUntilNextPhase(),
    };
  }
}

/**
 * Factory function
 */
export function createZoneSystem(config?: Partial<ZoneConfig>): ZoneSystem {
  return new ZoneSystem(config);
}
