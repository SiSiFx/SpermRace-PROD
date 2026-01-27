import { Car, Trail, ArenaBounds } from './types';

export interface CollisionResult {
  victim: Car;
  killer: Car | null;
  hitPoint: { x: number; y: number };
}

export class Collision {
  checkTrailCollisions(cars: Car[], trails: Trail[]): CollisionResult[] {
    const results: CollisionResult[] = [];
    const hitRadius = 12;

    for (const car of cars) {
      if (car.destroyed) continue;

      for (const trail of trails) {
        // Skip own trail (last 5 points for safety)
        const isOwnTrail = trail.carId === car.id;
        const points = trail.points;
        const skipCount = isOwnTrail ? 5 : 0;

        for (let i = skipCount + 1; i < points.length; i++) {
          const p0 = points[i - 1];
          const p1 = points[i];

          const dist = this.pointToSegmentDistance(car.x, car.y, p0.x, p0.y, p1.x, p1.y);

          if (dist < hitRadius) {
            results.push({
              victim: car,
              killer: isOwnTrail ? null : trail.car,
              hitPoint: { x: car.x, y: car.y }
            });
            break;
          }
        }
      }
    }

    return results;
  }

  checkArenaBounds(car: Car, arena: ArenaBounds): boolean {
    const halfW = arena.width / 2;
    const halfH = arena.height / 2;
    return car.x < -halfW || car.x > halfW || car.y < -halfH || car.y > halfH;
  }

  private pointToSegmentDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;

    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
  }
}
