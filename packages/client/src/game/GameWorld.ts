import * as PIXI from 'pixi.js';
import { Car, ArenaBounds, Pickup, BoostPad, ZoneBounds } from './types';

export class GameWorld {
  arena: ArenaBounds;
  zone: ZoneBounds;
  pickups: Pickup[] = [];
  boostPads: BoostPad[] = [];

  private worldContainer: PIXI.Container;
  private zoneGraphics: PIXI.Graphics;
  private gridGraphics: PIXI.Graphics;
  private pickupsContainer: PIXI.Container;

  private zoneStartTime = 0;
  private zoneDuration = 90000;

  constructor(container: PIXI.Container, arena: ArenaBounds) {
    this.worldContainer = container;
    this.arena = arena;

    // Initialize zone to full arena
    this.zone = {
      left: -arena.width / 2,
      right: arena.width / 2,
      top: -arena.height / 2,
      bottom: arena.height / 2
    };

    // Create graphics layers
    this.gridGraphics = new PIXI.Graphics();
    this.zoneGraphics = new PIXI.Graphics();
    this.pickupsContainer = new PIXI.Container();

    container.addChild(this.gridGraphics);
    container.addChild(this.zoneGraphics);
    container.addChild(this.pickupsContainer);

    this.drawGrid();
    this.spawnBoostPads(10);
  }

  private drawGrid(): void {
    const g = this.gridGraphics;
    const gridSize = 160;
    const halfW = this.arena.width / 2;
    const halfH = this.arena.height / 2;

    for (let x = -halfW; x <= halfW; x += gridSize) {
      g.moveTo(x, -halfH).lineTo(x, halfH);
    }
    for (let y = -halfH; y <= halfH; y += gridSize) {
      g.moveTo(-halfW, y).lineTo(halfW, y);
    }
    g.stroke({ width: 1, color: 0x2a2f38, alpha: 0.08 });

    // Border
    g.rect(-halfW, -halfH, this.arena.width, this.arena.height);
    g.stroke({ width: 4, color: 0x22d3ee, alpha: 0.6 });
  }

  private spawnBoostPads(count: number): void {
    const halfW = this.arena.width / 2 - 200;
    const halfH = this.arena.height / 2 - 200;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * halfW * 2;
      const y = (Math.random() - 0.5) * halfH * 2;
      const g = new PIXI.Graphics();
      g.circle(0, 0, 30).fill({ color: 0x22d3ee, alpha: 0.3 });
      g.x = x;
      g.y = y;
      this.worldContainer.addChild(g);

      this.boostPads.push({
        x, y,
        radius: 30,
        cooldownMs: 5000,
        lastTriggeredAt: 0,
        graphics: g
      });
    }
  }

  startZone(): void {
    this.zoneStartTime = Date.now();
  }

  updateZone(cars: Car[]): void {
    if (!this.zoneStartTime) return;

    const elapsed = Date.now() - this.zoneStartTime;
    const progress = Math.min(1, elapsed / this.zoneDuration);

    // Shrink zone over time
    const shrinkAmount = progress * (this.arena.width / 2 - 150);
    this.zone.left = -this.arena.width / 2 + shrinkAmount;
    this.zone.right = this.arena.width / 2 - shrinkAmount;
    this.zone.top = -this.arena.height / 2 + shrinkAmount;
    this.zone.bottom = this.arena.height / 2 - shrinkAmount;

    // Draw zone
    this.zoneGraphics.clear();
    const w = this.zone.right - this.zone.left;
    const h = this.zone.bottom - this.zone.top;
    this.zoneGraphics.rect(this.zone.left, this.zone.top, w, h);
    this.zoneGraphics.stroke({ width: 3, color: 0xef4444, alpha: 0.8 });

    // Damage cars outside zone
    for (const car of cars) {
      if (car.destroyed) continue;
      if (this.isOutsideZone(car.x, car.y)) {
        car.outZoneTime = (car.outZoneTime || 0) + 1/60;
        if (car.outZoneTime > 3) {
          car.destroyed = true;
        }
      } else {
        car.outZoneTime = 0;
      }
    }
  }

  isOutsideZone(x: number, y: number): boolean {
    return x < this.zone.left || x > this.zone.right ||
           y < this.zone.top || y > this.zone.bottom;
  }

  getSpawnPoint(): { x: number; y: number; angle: number } {
    const margin = 200;
    return {
      x: (Math.random() - 0.5) * (this.arena.width - margin * 2),
      y: (Math.random() - 0.5) * (this.arena.height - margin * 2),
      angle: Math.random() * Math.PI * 2
    };
  }

  destroy(): void {
    this.gridGraphics.destroy();
    this.zoneGraphics.destroy();
    this.pickupsContainer.destroy();
    this.boostPads.forEach(p => p.graphics.destroy());
  }
}
