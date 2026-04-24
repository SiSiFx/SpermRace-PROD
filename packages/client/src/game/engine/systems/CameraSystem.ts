/**
 * Camera System
 * Manages camera positioning, zoom, and screen shake effects
 * Separated from RenderSystem for better ECS architecture
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Boost } from '../components/Boost';
import { ComponentNames } from '../components';

/**
 * Camera configuration
 */
export interface CameraConfig {
  /** Target entity to follow */
  targetId: string | null;

  /** Camera X position (world space) */
  x: number;

  /** Camera Y position (world space) */
  y: number;

  /** Current zoom level */
  zoom: number;

  /** Target zoom level (for smooth transitions) */
  targetZoom: number;

  /** Smooth factor for camera movement (0-1, lower = smoother) */
  smoothFactor: number;

  /** Screen width (pixels) */
  screenWidth: number;

  /** Screen height (pixels) */
  screenHeight: number;

  /** Screen shake intensity (0-1) */
  shakeIntensity: number;

  /** Screen shake decay (per second) */
  shakeDecay: number;
}

/**
 * Camera system config
 */
export interface CameraSystemConfig {
  /** Initial zoom level */
  initialZoom?: number;

  /** Camera smooth factor */
  smoothFactor?: number;

  /** Screen shake decay rate */
  shakeDecay?: number;
}

/**
 * Camera System
 * Manages camera positioning and effects
 */
export class CameraSystem extends System {
  public readonly priority = SystemPriority.PHYSICS - 1; // Run before physics for smooth camera

  private readonly _camera: CameraConfig;
  private _defaultZoom: number;
  private _boostZoomOut: number = 0.80; // Clear zoom-out on boost so extra speed is perceptible

  constructor(config?: CameraSystemConfig) {
    super(SystemPriority.PHYSICS - 1);

    const initialZoom = config?.initialZoom ?? 1.0;
    this._defaultZoom = initialZoom;

    this._camera = {
      targetId: null,
      x: 0,
      y: 0,
      zoom: initialZoom,
      targetZoom: initialZoom,
      smoothFactor: config?.smoothFactor ?? 0.18,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      shakeIntensity: 0,
      shakeDecay: config?.shakeDecay ?? 6.0,
    };
  }

  /**
   * Update camera
   */
  update(dt: number): void {
    // Normalise smooth factor to 60 fps so camera feel is frame-rate independent.
    // Without this, frame drops during boost particle effects cause jerky camera movement.
    const dtAlpha = Math.min(1, this._camera.smoothFactor * dt * 60);

    // Update camera position to follow target
    if (this._camera.targetId) {
      const target = this.entityManager.getEntity(this._camera.targetId);
      if (target) {
        const position = target.getComponent<Position>(ComponentNames.POSITION);
        if (position) {
          // Smooth follow — dt-normalised so behaviour is identical at any frame rate
          this._camera.x += (position.x - this._camera.x) * dtAlpha;
          this._camera.y += (position.y - this._camera.y) * dtAlpha;
        }

        // Dynamic zoom based on boost state (zoom out when boosting for more visibility)
        const boost = target.getComponent<Boost>(ComponentNames.BOOST);
        if (boost?.isBoosting) {
          this._camera.targetZoom = this._defaultZoom * this._boostZoomOut;
        } else {
          // Only reset if we're not manually zoomed
          if (Math.abs(this._camera.targetZoom - this._defaultZoom * this._boostZoomOut) < 0.01) {
            this._camera.targetZoom = this._defaultZoom;
          }
        }
      }
    }

    // Smooth zoom transition — also dt-normalised
    this._camera.zoom += (this._camera.targetZoom - this._camera.zoom) * dtAlpha;

    // Update screen shake
    if (!Number.isFinite(this._camera.shakeIntensity) || this._camera.shakeIntensity < 0) {
      this._camera.shakeIntensity = 0;
    } else if (this._camera.shakeIntensity > 0.01) {
      // Exponential decay that stays stable for any positive decay value.
      this._camera.shakeIntensity *= Math.exp(-this._camera.shakeDecay * Math.max(0, dt));
      if (this._camera.shakeIntensity < 0.01) {
        this._camera.shakeIntensity = 0;
      }
    }
  }

  /**
   * Set camera target entity
   */
  setTarget(entityId: string | null): void {
    this._camera.targetId = entityId;
  }

  /**
   * Get camera target
   */
  getTarget(): string | null {
    return this._camera.targetId;
  }

  /**
   * Set camera position directly (overrides follow)
   */
  setPosition(x: number, y: number): void {
    this._camera.x = x;
    this._camera.y = y;
    this._camera.targetId = null; // Clear follow target
  }

  /**
   * Get camera position
   */
  getPosition(): { x: number; y: number } {
    return { x: this._camera.x, y: this._camera.y };
  }

  /**
   * Set target zoom level
   */
  setZoom(zoom: number): void {
    this._camera.targetZoom = Math.max(0.1, Math.min(3, zoom));
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this._camera.zoom;
  }

  /**
   * Add screen shake
   * @param intensity - Shake intensity (0-1, will be clamped)
   */
  addShake(intensity: number): void {
    this._camera.shakeIntensity = Math.min(1, Math.max(0, this._camera.shakeIntensity + intensity));
  }

  /**
   * Set screen shake intensity directly
   */
  setShake(intensity: number): void {
    this._camera.shakeIntensity = Math.min(1, Math.max(0, intensity));
  }

  /**
   * Trigger screen shake with intensity and duration
   * @param intensity - Shake intensity (0-1)
   * @param duration - Duration in seconds (used to calculate decay)
   */
  shake(intensity: number, duration: number = 0.3): void {
    this._camera.shakeIntensity = Math.min(1, Math.max(0, intensity));
    // Adjust shake decay based on desired duration
    if (duration > 0) {
      this._camera.shakeDecay = -Math.log(0.01) / duration; // Decay to 1% in duration time
    }
  }

  /**
   * Get current shake intensity
   */
  getShakeIntensity(): number {
    return this._camera.shakeIntensity;
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this._camera.x) * this._camera.zoom + this._camera.screenWidth / 2,
      y: (worldY - this._camera.y) * this._camera.zoom + this._camera.screenHeight / 2,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this._camera.screenWidth / 2) / this._camera.zoom + this._camera.x,
      y: (screenY - this._camera.screenHeight / 2) / this._camera.zoom + this._camera.y,
    };
  }

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    this._camera.screenWidth = width;
    this._camera.screenHeight = height;
  }

  /**
   * Get camera config (for RenderSystem to apply transforms)
   */
  getCameraConfig(): Readonly<CameraConfig> {
    return this._camera;
  }

  /**
   * Get shake offset for rendering
   */
  getShakeOffset(): { x: number; y: number } {
    if (!Number.isFinite(this._camera.shakeIntensity) || this._camera.shakeIntensity <= 0.01) {
      this._camera.shakeIntensity = 0;
      return { x: 0, y: 0 };
    }
    // Smooth sine-wave shake — two co-prime frequencies give non-repeating motion
    const t = Date.now() / 1000;
    const mag = this._camera.shakeIntensity * 5;
    return {
      x: Math.sin(t * 47.1) * mag,
      y: Math.sin(t * 37.7 + 1.2) * mag,
    };
  }
}

/**
 * Factory function
 */
export function createCameraSystem(config?: CameraSystemConfig): CameraSystem {
  return new CameraSystem(config);
}
