/**
 * Floating Text System
 * Manages animated text popups for damage, XP, and game events
 */

import { System, SystemPriority } from '../core/System';
import { Text, Container, TextStyle } from 'pixi.js';

export interface FloatingTextConfig {
  /** Initial scale */
  scale?: number;
  /** Float speed (pixels/sec) */
  speed?: number;
  /** Lifetime (seconds) */
  lifetime?: number;
  /** Font size */
  fontSize?: number;
}

interface ActiveText {
  text: Text;
  life: number;
  maxLife: number;
  speed: number;
  vx: number;
  vy: number;
  active: boolean;
}

export class FloatingTextSystem extends System {
  public readonly priority = SystemPriority.UI; // Run after rendering? No, PIXI rendering is last.
  // Wait, RenderSystem runs at 100. UI runs at 50.
  // This system UPDATES text positions. RenderSystem renders the container.
  // So it should run before Rendering.
  
  private _container: Container | null = null;
  private _activeTexts: ActiveText[] = [];
  private _pool: Text[] = [];

  constructor() {
    super(SystemPriority.EFFECTS); // Same as other visual effects
  }

  /**
   * Set container for text rendering
   */
  setContainer(container: Container): void {
    this._container = container;
  }

  /**
   * Update all active texts
   */
  update(dt: number): void {
    if (!this._container) return;

    for (let i = this._activeTexts.length - 1; i >= 0; i--) {
      const item = this._activeTexts[i];
      if (!item.active) continue;

      item.life -= dt;

      if (item.life <= 0) {
        this._recycle(item);
        this._activeTexts.splice(i, 1);
        continue;
      }

      // Physics
      item.text.x += item.vx * dt;
      item.text.y += item.vy * dt;

      // Animation
      const progress = 1 - (item.life / item.maxLife);
      
      // Float up
      item.text.y -= item.speed * dt;

      // Fade out in last 30%
      if (progress > 0.7) {
        item.text.alpha = 1 - ((progress - 0.7) / 0.3);
      } else {
        item.text.alpha = 1;
      }

      // Scale punch
      if (progress < 0.2) {
        // Pop up
        const s = 1 + Math.sin(progress * Math.PI * 2.5) * 0.2;
        item.text.scale.set(s);
      } else {
        // Settle
        item.text.scale.set(1);
      }
    }
  }

  /**
   * Spawn floating text
   */
  spawnText(x: number, y: number, content: string, color: number | string, config?: FloatingTextConfig): void {
    if (!this._container) return;

    const text = this._getAvailableText();
    
    text.text = content;
    text.style = new TextStyle({
      fontFamily: 'Arial', // Or Orbitron/Inter if loaded
      fontSize: config?.fontSize ?? 24,
      fontWeight: 'bold',
      fill: color,
      stroke: { color: '#000000', width: 4 },
      dropShadow: {
        color: '#000000',
        blur: 2,
        angle: Math.PI / 6,
        distance: 2,
      },
    });
    
    text.x = x;
    text.y = y;
    text.anchor.set(0.5);
    text.alpha = 1;
    text.scale.set(0);
    text.visible = true;

    this._container.addChild(text);

    this._activeTexts.push({
      text,
      life: config?.lifetime ?? 1.5,
      maxLife: config?.lifetime ?? 1.5,
      speed: config?.speed ?? 50,
      vx: (Math.random() - 0.5) * 20, // Slight drift
      vy: 0,
      active: true,
    });
  }

  /**
   * Get text from pool or create new
   */
  private _getAvailableText(): Text {
    if (this._pool.length > 0) {
      return this._pool.pop()!;
    }
    return new Text({ text: '' });
  }

  /**
   * Recycle text back to pool
   */
  private _recycle(item: ActiveText): void {
    item.active = false;
    item.text.visible = false;
    if (item.text.parent) {
      item.text.parent.removeChild(item.text);
    }
    this._pool.push(item.text);
  }

  /**
   * Destroy system
   */
  destroy(): void {
    this._activeTexts.forEach(item => this._recycle(item));
    this._activeTexts = [];
    this._pool.forEach(t => t.destroy());
    this._pool = [];
    this._container = null;
  }
}
