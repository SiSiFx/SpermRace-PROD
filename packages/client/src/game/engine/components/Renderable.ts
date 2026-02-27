/**
 * Renderable component
 * Stores rendering data for entities
 */

/**
 * Render layer for z-ordering
 */
export enum RenderLayer {
  /** Background (grid, arena) */
  BACKGROUND = 0,

  /** Ground decorations */
  GROUND = 1,

  /** Trails */
  TRAILS = 2,

  /** Powerups */
  POWERUPS = 3,

  /** Dead bodies/debris */
  CORPSES = 4,

  /** Cars/Players */
  CARS = 5,

  /** Active effects (explosions, etc.) */
  EFFECTS = 6,

  /** UI elements in world space */
  WORLD_UI = 7,

  /** Overlay effects */
  OVERLAY = 8,
}

/**
 * Renderable component
 */
export interface Renderable {
  /** PIXI display object (created by render system) */
  displayObject: any;

  /** Render layer for z-ordering */
  layer: RenderLayer;

  /** Visibility flag */
  visible: boolean;

  /** Opacity (0-1) */
  alpha: number;

  /** Scale multiplier */
  scale: number;

  /** Rotation offset (in addition to entity angle) */
  rotationOffset: number;

  /** Whether to flip horizontally */
  flipX: boolean;

  /** Whether to flip vertically */
  flipY: boolean;

  /** Sort key within layer (for fine-grained ordering) */
  sortKey: number;
}

/** Component name for type-safe access */
export const RENDERABLE_COMPONENT = 'Renderable';

/**
 * Create a renderable component
 */
export function createRenderable(config?: Partial<Renderable>): Renderable {
  return {
    displayObject: null,
    layer: RenderLayer.CARS,
    visible: true,
    alpha: 1,
    scale: 1,
    rotationOffset: 0,
    flipX: false,
    flipY: false,
    sortKey: 0,
    ...config,
  };
}

/**
 * Set render layer
 */
export function setRenderLayer(renderable: Renderable, layer: RenderLayer): void {
  renderable.layer = layer;
}

/**
 * Set visibility
 */
export function setVisible(renderable: Renderable, visible: boolean): void {
  renderable.visible = visible;
}

/**
 * Set alpha
 */
export function setAlpha(renderable: Renderable, alpha: number): void {
  renderable.alpha = Math.max(0, Math.min(1, alpha));
}

/**
 * Set scale
 */
export function setScale(renderable: Renderable, scale: number): void {
  renderable.scale = scale;
}
