/**
 * Slow Motion System
 * Manages game speed transitions for cinematic effect
 */

import { System, SystemPriority } from '../core/System';

/**
 * Slow motion system
 */
export class SlowMotionSystem extends System {
  public readonly priority = SystemPriority.EFFECTS;

  private _targetScale: number = 1.0;
  private _duration: number = 0;
  private _elapsed: number = 0;
  private _active: boolean = false;

  constructor() {
    super(SystemPriority.EFFECTS);
  }

  /**
   * Update time scale
   */
  update(dt: number): void {
    if (!this._active) return;

    // We use unscaled dt here? No, 'dt' passed to update() IS scaled by GameEngine!
    // This is tricky. If we want to time the slow motion duration in REAL time, 
    // we need unscaled dt.
    // GameEngine passes scaled 'frameTime'.
    // We can get unscaled frame time by dividing by current scale, or GameEngine could pass it.
    // Or we simply check `performance.now()`.
    
    // Let's use performance.now for duration tracking to be independent of game time scaling
    
    // Check if duration expired
    if (Date.now() > this._duration) {
      this.reset();
    }
  }

  /**
   * Trigger slow motion
   * @param scale Time scale (e.g. 0.3)
   * @param durationMs Duration in real milliseconds
   */
  trigger(scale: number, durationMs: number): void {
    const engine = this.getEngine();
    if (!engine) return;

    this._active = true;
    this._targetScale = scale;
    this._duration = Date.now() + durationMs;
    
    engine.setTimeScale?.(scale);
  }

  /**
   * Reset to normal speed
   */
  reset(): void {
    const engine = this.getEngine();
    if (!engine) return;

    this._active = false;
    this._targetScale = 1.0;
    engine.setTimeScale?.(1.0);
  }
}
