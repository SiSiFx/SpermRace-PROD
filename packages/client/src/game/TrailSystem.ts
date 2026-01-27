import * as PIXI from 'pixi.js';
import { Car, Trail, TrailPoint } from './types';

export class TrailSystem {
  private trails: Map<string, Trail> = new Map();
  private container: PIXI.Container;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  addPoint(car: Car): void {
    if (car.destroyed) return;

    const now = Date.now();
    const lastPoint = car.trailPoints[car.trailPoints.length - 1];

    // Only add point if moved enough distance
    if (lastPoint) {
      const dx = car.x - lastPoint.x;
      const dy = car.y - lastPoint.y;
      if (dx * dx + dy * dy < 225) return; // 15px minimum
    }

    const point: TrailPoint = {
      x: car.x,
      y: car.y,
      time: now,
      isBoosting: car.isBoosting,
      expiresAt: now + 8000 // 8 second trail life
    };

    car.trailPoints.push(point);

    // Get or create trail
    let trail = this.trails.get(car.id);
    if (!trail) {
      const graphics = new PIXI.Graphics();
      this.container.addChild(graphics);
      trail = { carId: car.id, car, points: [], graphics };
      this.trails.set(car.id, trail);
    }
    trail.points = car.trailPoints;
  }

  update(): void {
    const now = Date.now();

    this.trails.forEach((trail, carId) => {
      // Remove expired points
      trail.points = trail.points.filter(p => !p.expiresAt || p.expiresAt > now);
      trail.car.trailPoints = trail.points;

      // Render trail
      this.renderTrail(trail);

      // Remove empty trails
      if (trail.points.length === 0) {
        this.container.removeChild(trail.graphics);
        this.trails.delete(carId);
      }
    });
  }

  private renderTrail(trail: Trail): void {
    const g = trail.graphics;
    g.clear();

    if (trail.points.length < 2) return;

    const color = trail.car.color;

    for (let i = 1; i < trail.points.length; i++) {
      const p0 = trail.points[i - 1];
      const p1 = trail.points[i];
      const width = p1.isBoosting ? 6 : 4;
      const alpha = p1.isBoosting ? 0.9 : 0.7;

      g.moveTo(p0.x, p0.y);
      g.lineTo(p1.x, p1.y);
      g.stroke({ width, color, alpha });
    }
  }

  getTrails(): Trail[] {
    return Array.from(this.trails.values());
  }

  clear(): void {
    this.trails.forEach(trail => {
      this.container.removeChild(trail.graphics);
    });
    this.trails.clear();
  }
}
