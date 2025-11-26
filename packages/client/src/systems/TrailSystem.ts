import * as PIXI from 'pixi.js';
import type { Car, Trail } from '../types';

export class TrailSystem {
    public trails: Trail[] = [];
    private container: PIXI.Container;


    // Callbacks for game events
    public onCollision?: (victim: Car, owner: Car) => void;
    public onNearMiss?: (x: number, y: number, distance: number) => void;

    constructor(container: PIXI.Container, app: PIXI.Application) {
        this.container = container;
        // this.app = app;
    }

    public addPoint(car: Car) {
        const now = Date.now();
        const interval = 30;

        if (now - car.lastTrailTime > interval) {
            // Get or create trail for this car
            let trail = this.trails.find(t => t.carId === car.id);
            if (!trail) {
                // Create graphics for trail rendering
                const graphics = new PIXI.Graphics();
                graphics.blendMode = 'add'; // Glow effect

                trail = {
                    carId: car.id,
                    car: car,
                    points: [],
                    graphics: graphics
                };
                this.trails.push(trail);
                try { this.container.addChild(trail.graphics); } catch { }
            }

            // Add new point
            trail.points.push({
                x: car.x,
                y: car.y,
                time: now,
                isBoosting: car.isBoosting
            });

            car.lastTrailTime = now;
        }
    }

    public update() {
        // Update and clean trails
        for (let i = this.trails.length - 1; i >= 0; i--) {
            const trail = this.trails[i];
            const now = Date.now();

            // Remove old points (manual loop to avoid allocation)
            const maxAge = 3.0;
            let removeCount = 0;
            for (let j = 0; j < trail.points.length; j++) {
                if ((now - trail.points[j].time) / 1000 > maxAge) {
                    removeCount++;
                } else {
                    break;
                }
            }
            if (removeCount > 0) {
                trail.points.splice(0, removeCount);
            }

            // Remove trail if no points left
            if (trail.points.length === 0) {
                if (trail.graphics && trail.graphics.parent) {
                    try { trail.graphics.parent.removeChild(trail.graphics); } catch { }
                    try { trail.graphics.destroy(); } catch { }
                }
                this.trails.splice(i, 1);
            } else {
                // Update trail visuals
                this.renderTrail(trail);
            }
        }
    }

    private renderTrail(trail: Trail) {
        if (!trail.graphics || trail.points.length < 2) {
            if (trail.graphics) trail.graphics.visible = false;
            return;
        }
        trail.graphics.visible = true;

        // Ensure graphics is in container
        if (this.container && trail.graphics.parent !== this.container) {
            this.container.addChild(trail.graphics);
        }

        const now = Date.now();
        const car = trail.car;

        // Clear previous frame
        trail.graphics.clear();

        // Collect recent points
        const validPoints = trail.points.filter(p => (now - p.time) / 1000 < 3.0);
        if (validPoints.length < 2) return;

        // Draw trail as smooth line
        const baseWidth = 8;
        const boostWidth = 14;

        // Set line style with car's color
        trail.graphics.stroke({
            width: car.isBoosting ? boostWidth : baseWidth,
            color: car.color,
            alpha: 0.9,
            cap: 'round',
            join: 'round'
        });

        // Draw all points in one draw call
        trail.graphics.moveTo(car.x, car.y); // Start at car position

        for (let i = validPoints.length - 1; i >= 0; i--) {
            const p = validPoints[i];
            const age = (now - p.time) / 1000;

            // Fade out older points
            const alpha = Math.max(0.3, 1 - age / 3.0);

            // Adjust width for boosting sections
            const width = p.isBoosting ? boostWidth : baseWidth;

            // Update line style if width or alpha changed significantly
            if (i === validPoints.length - 1 || Math.abs(width - (validPoints[i + 1]?.isBoosting ? boostWidth : baseWidth)) > 2) {
                trail.graphics.stroke({
                    width,
                    color: car.color,
                    alpha,
                    cap: 'round',
                    join: 'round'
                });
            }

            trail.graphics.lineTo(p.x, p.y);
        }
    }

    public checkCollisions(cars: Car[], player: Car | null) {
        for (const car of cars) {
            if (!car || car.destroyed) continue;

            let closestMiss = Infinity;
            let missX = 0, missY = 0;

            for (const trail of this.trails) {
                if (trail.points.length < 2) continue;
                if (trail.car === car) continue; // Cannot hit own trail



                // Check collision with trail segments
                for (let i = 1; i < trail.points.length; i++) {
                    const p1 = trail.points[i - 1];
                    const p2 = trail.points[i];

                    // Optimization: skip if segment is too far (simple box check)
                    const minX = Math.min(p1.x, p2.x) - 20;
                    const maxX = Math.max(p1.x, p2.x) + 20;
                    const minY = Math.min(p1.y, p2.y) - 20;
                    const maxY = Math.max(p1.y, p2.y) + 20;

                    if (car.x < minX || car.x > maxX || car.y < minY || car.y > maxY) continue;

                    const dist = this.pointToLineDistance(car.x, car.y, p1.x, p1.y, p2.x, p2.y);
                    const hitboxSize = p2.isBoosting ? 14 : 8; // Slightly generous hitboxes

                    if (dist < hitboxSize) {
                        if (this.onCollision) {
                            this.onCollision(car, trail.car);
                        }
                        break;
                    }

                    // NEAR-MISS DETECTION
                    if (car === player && dist < 40 && dist < closestMiss) {
                        closestMiss = dist;
                        missX = (p1.x + p2.x) / 2;
                        missY = (p1.y + p2.y) / 2;
                    }
                }
                if (car.destroyed) break;
            }

            // Show near-miss notification
            if (car === player && closestMiss < 40 && Math.random() < 0.3) {
                if (this.onNearMiss) {
                    this.onNearMiss(missX, missY, closestMiss);
                }
            }
        }
    }

    public removeTrail(car: Car) {
        const tIdx = this.trails.findIndex(t => t.car === car);
        if (tIdx >= 0) {
            const trail = this.trails[tIdx];
            trail.points = [];
            try {
                if (trail.graphics && trail.graphics.parent) trail.graphics.parent.removeChild(trail.graphics);
                trail.graphics.destroy();
            } catch { }
            this.trails.splice(tIdx, 1);
        }
    }

    private pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) {
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const projection = {
            x: x1 + t * dx,
            y: y1 + t * dy
        };

        return Math.sqrt((px - projection.x) * (px - projection.x) + (py - projection.y) * (py - projection.y));
    }
}
