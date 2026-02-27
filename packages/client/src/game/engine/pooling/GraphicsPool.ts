/**
 * Graphics Object Pool
 * Pool for PIXI DisplayObjects to reduce graphics memory churn
 */

import * as PIXI from 'pixi.js';
import { ObjectPool } from './ObjectPool';

/**
 * Graphics pool entry
 */
interface PooledGraphics {
  /** The display object */
  displayObject: PIXI.Container | PIXI.Graphics | PIXI.Sprite | PIXI.Text;

  /** Current layer */
  layer: number;

  /** Whether it's currently in use */
  inUse: boolean;
}

/**
 * Graphics pool for PIXI display objects
 * Manages pooling for different types of graphics objects
 */
export class GraphicsPool {
  /** Container graphics pool */
  private readonly _containerPool: ObjectPool<PIXI.Container>;

  /** Graphics pool */
  private readonly _graphicsPool: ObjectPool<PIXI.Graphics>;

  /** Sprite pool (needs texture management) */
  private readonly _spritePool: ObjectPool<PIXI.Sprite>;

  /** Text pool */
  private readonly _textPool: ObjectPool<PIXI.Text>;

  /** Pool of all display objects with metadata */
  private readonly _allObjects: Map<PIXI.Container | PIXI.Graphics | PIXI.Sprite | PIXI.Text, PooledGraphics> = new Map();

  constructor() {
    this._containerPool = new ObjectPool({
      create: () => this._createContainer(),
      reset: (c) => this._resetContainer(c),
      initialSize: 100,
      maxSize: 1000,
    });

    this._graphicsPool = new ObjectPool({
      create: () => this._createGraphics(),
      reset: (g) => this._resetGraphics(g),
      initialSize: 200,
      maxSize: 2000,
    });

    this._spritePool = new ObjectPool({
      create: () => this._createSprite(),
      reset: (s) => this._resetSprite(s),
      initialSize: 50,
      maxSize: 500,
    });

    this._textPool = new ObjectPool({
      create: () => this._createText(),
      reset: (t) => this._resetText(t),
      initialSize: 20,
      maxSize: 200,
    });
  }

  /**
   * Acquire a container
   */
  acquireContainer(): PIXI.Container {
    const container = this._containerPool.acquire();
    this._markInUse(container, 0);
    return container;
  }

  /**
   * Release a container
   */
  releaseContainer(container: PIXI.Container): void {
    this._markReleased(container);
    this._containerPool.release(container);
  }

  /**
   * Acquire a graphics object
   */
  acquireGraphics(): PIXI.Graphics {
    const graphics = this._graphicsPool.acquire();
    this._markInUse(graphics, 0);
    return graphics;
  }

  /**
   * Release a graphics object
   */
  releaseGraphics(graphics: PIXI.Graphics): void {
    this._markReleased(graphics);
    this._graphicsPool.release(graphics);
  }

  /**
   * Acquire a sprite
   */
  acquireSprite(texture?: PIXI.Texture): PIXI.Sprite {
    const sprite = this._spritePool.acquire();
    if (texture) {
      sprite.texture = texture;
    }
    this._markInUse(sprite, 0);
    return sprite;
  }

  /**
   * Release a sprite
   */
  releaseSprite(sprite: PIXI.Sprite): void {
    this._markReleased(sprite);
    this._spritePool.release(sprite);
  }

  /**
   * Acquire a text object
   */
  acquireText(text?: string, style?: PIXI.TextStyle): PIXI.Text {
    const textObj = this._textPool.acquire();
    if (text !== undefined) textObj.text = text;
    if (style) textObj.style = style;
    this._markInUse(textObj, 0);
    return textObj;
  }

  /**
   * Release a text object
   */
  releaseText(textObj: PIXI.Text): void {
    this._markReleased(textObj);
    this._textPool.release(textObj);
  }

  /**
   * Get combined pool statistics
   */
  getStats() {
    return {
      container: this._containerPool.getStats(),
      graphics: this._graphicsPool.getStats(),
      sprite: this._spritePool.getStats(),
      text: this._textPool.getStats(),
      total: {
        available:
          this._containerPool.available +
          this._graphicsPool.available +
          this._spritePool.available +
          this._textPool.available,
        inUse:
          this._containerPool.inUse +
          this._graphicsPool.inUse +
          this._spritePool.inUse +
          this._textPool.inUse,
        total:
          this._containerPool.size +
          this._graphicsPool.size +
          this._spritePool.size +
          this._textPool.size,
      },
    };
  }

  /**
   * Clear all pools
   */
  clear(): void {
    // Destroy all tracked objects before clearing
    for (const [obj, data] of this._allObjects) {
      try {
        obj.destroy({ children: true });
      } catch {
        // Ignore errors during cleanup
      }
    }
    this._allObjects.clear();

    this._containerPool.clear();
    this._graphicsPool.clear();
    this._spritePool.clear();
    this._textPool.clear();
  }

  /**
   * Destroy the graphics pool and release all resources
   */
  destroy(): void {
    this.clear();

    // Also clear texture references from sprite pool
    for (const sprite of this._spritePool.getPool?.() ?? []) {
      if (sprite.texture && sprite.texture !== PIXI.Texture.EMPTY) {
        try {
          sprite.texture.destroy(false);
        } catch {
          // Texture may be shared
        }
      }
    }
  }

  /**
   * Create a container
   */
  private _createContainer(): PIXI.Container {
    const container = new PIXI.Container();
    container.sortableChildren = true;
    return container;
  }

  /**
   * Reset a container
   */
  private _resetContainer(container: PIXI.Container): void {
    container.removeChildren();
    container.x = 0;
    container.y = 0;
    container.rotation = 0;
    container.scale.set(1);
    container.alpha = 1;
    container.visible = true;
    container.zIndex = 0;
  }

  /**
   * Create a graphics object
   */
  private _createGraphics(): PIXI.Graphics {
    return new PIXI.Graphics();
  }

  /**
   * Reset a graphics object
   */
  private _resetGraphics(graphics: PIXI.Graphics): void {
    graphics.clear();
    graphics.x = 0;
    graphics.y = 0;
    graphics.rotation = 0;
    graphics.scale.set(1);
    graphics.alpha = 1;
    graphics.visible = true;
    graphics.zIndex = 0;
  }

  /**
   * Create a sprite
   */
  private _createSprite(): PIXI.Sprite {
    const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    sprite.anchor.set(0.5);
    return sprite;
  }

  /**
   * Reset a sprite
   */
  private _resetSprite(sprite: PIXI.Sprite): void {
    sprite.texture = PIXI.Texture.EMPTY;
    sprite.x = 0;
    sprite.y = 0;
    sprite.rotation = 0;
    sprite.scale.set(1);
    sprite.alpha = 1;
    sprite.visible = true;
    sprite.anchor.set(0.5);
  }

  /**
   * Create a text object
   */
  private _createText(): PIXI.Text {
    return new PIXI.Text('', {
      fontSize: 16,
      fill: 0xffffff,
      align: 'center',
    });
  }

  /**
   * Reset a text object
   */
  private _resetText(textObj: PIXI.Text): void {
    textObj.text = '';
    textObj.x = 0;
    textObj.y = 0;
    textObj.rotation = 0;
    textObj.scale.set(1);
    textObj.alpha = 1;
    textObj.visible = true;
    textObj.anchor.set(0.5);
  }

  /**
   * Mark object as in use
   */
  private _markInUse(obj: PIXI.Container | PIXI.Graphics | PIXI.Sprite | PIXI.Text, layer: number): void {
    const data = this._allObjects.get(obj);
    if (data) {
      data.inUse = true;
      data.layer = layer;
    } else {
      this._allObjects.set(obj, { displayObject: obj, layer, inUse: true });
    }
  }

  /**
   * Mark object as released
   */
  private _markReleased(obj: PIXI.Container | PIXI.Graphics | PIXI.Sprite | PIXI.Text): void {
    const data = this._allObjects.get(obj);
    if (data) {
      data.inUse = false;
    }
  }
}

/**
 * Global graphics pool instance
 */
let globalGraphicsPool: GraphicsPool | null = null;

export function getGraphicsPool(): GraphicsPool {
  if (!globalGraphicsPool) {
    globalGraphicsPool = new GraphicsPool();
  }
  return globalGraphicsPool;
}

export function setGraphicsPool(pool: GraphicsPool): void {
  globalGraphicsPool = pool;
}

/**
 * Helper to acquire a graphics object
 */
export function acquireGraphics(): PIXI.Graphics {
  return getGraphicsPool().acquireGraphics();
}

/**
 * Helper to release a graphics object
 */
export function releaseGraphics(graphics: PIXI.Graphics): void {
  getGraphicsPool().releaseGraphics(graphics);
}

/**
 * Helper to acquire a container
 */
export function acquireContainer(): PIXI.Container {
  return getGraphicsPool().acquireContainer();
}

/**
 * Helper to release a container
 */
export function releaseContainer(container: PIXI.Container): void {
  getGraphicsPool().releaseContainer(container);
}
