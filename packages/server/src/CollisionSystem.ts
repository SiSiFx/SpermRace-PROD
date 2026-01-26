import { PlayerEntity } from './Player.js';
import { Vector2, TrailPoint } from 'shared';
import { COLLISION as S_COLLISION } from 'shared/dist/constants.js';

// =================================================================================================
// CONSTANTS
// =================================================================================================

const GRID_CELL_SIZE = S_COLLISION.GRID_CELL_SIZE; // Size of each cell in the spatial hash grid
const SPERM_COLLISION_RADIUS = S_COLLISION.SPERM_COLLISION_RADIUS; // Hitbox radius for the spermatozoide
const TRAIL_COLLISION_RADIUS = S_COLLISION.TRAIL_COLLISION_RADIUS; // Hitbox radius for a trail point
const SELF_COLLISION_BUFFER = 20; // keep index-based as a supplemental guard
const SELF_IGNORE_RECENT_MS = S_COLLISION.SELF_IGNORE_RECENT_MS; // time-based fairness
const SPAWN_SELF_COLLISION_GRACE_MS = S_COLLISION.SPAWN_SELF_COLLISION_GRACE_MS; // extended grace after spawn for ultrafast
const POST_BOUNCE_GRACE_MS = S_COLLISION.POST_BOUNCE_GRACE_MS; // longer grace after wall bounce

// =================================================================================================
// SPATIAL HASH GRID
// =================================================================================================

interface GridEntry {
  playerId: string;
  point: TrailPoint;
  pointIndex: number; // Track the index to avoid expensive indexOf calls
}

class SpatialHashGrid {
  private grid: Map<string, GridEntry[]> = new Map();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private getKey(position: Vector2): string {
    const cellX = Math.floor(position.x / this.cellSize);
    const cellY = Math.floor(position.y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  clear(): void {
    this.grid.clear();
  }

  insert(playerId: string, point: TrailPoint, pointIndex: number): void {
    const key = this.getKey(point);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push({ playerId, point, pointIndex });
  }

  getNearby(position: Vector2): GridEntry[] {
    const nearbyEntries: GridEntry[] = [];
    const centerX = Math.floor(position.x / this.cellSize);
    const centerY = Math.floor(position.y / this.cellSize);

    for (let x = centerX - 1; x <= centerX + 1; x++) {
      for (let y = centerY - 1; y <= centerY + 1; y++) {
        const key = `${x},${y}`;
        if (this.grid.has(key)) {
          nearbyEntries.push(...this.grid.get(key)!);
        }
      }
    }
    return nearbyEntries;
  }
}

// =================================================================================================
// COLLISION SYSTEM
// =================================================================================================

export class CollisionSystem {
  private grid: SpatialHashGrid;
  private worldBounds: { width: number; height: number };

  constructor(worldWidth: number, worldHeight: number) {
    this.grid = new SpatialHashGrid(GRID_CELL_SIZE);
    this.worldBounds = { width: worldWidth, height: worldHeight };
  }

  setWorldBounds(width: number, height: number): void {
    this.worldBounds.width = width;
    this.worldBounds.height = height;
  }

  /**
   * Updates the collision system with the current player states and detects collisions.
   * @param players A map of all players in the game.
   * @returns A set of player IDs that were eliminated in this frame.
   */
  update(players: Map<string, PlayerEntity>): Array<{ victimId: string; killerId?: string; debug?: { type: 'trail'; hit: { x: number; y: number }; segment?: { from: { x: number; y: number }; to: { x: number; y: number } }; normal?: { x: number; y: number }; relSpeed?: number } }> {
    const eliminated: Array<{ victimId: string; killerId?: string; debug?: { type: 'trail'; hit: { x: number; y: number }; segment?: { from: { x: number; y: number }; to: { x: number; y: number } }; normal?: { x: number; y: number }; relSpeed?: number } }> = [];

    // 1. Build the spatial grid from player trails
    this.grid.clear();
    for (const player of players.values()) {
      if (!player.isAlive) continue;
      player.trail.forEach((point, index) => this.grid.insert(player.id, point, index));
    }

    // 2. Check for collisions for each player
    for (const player of players.values()) {
      if (!player.isAlive) continue;

      // a. World boundary collision -> bounce back with softer damping
      if (player.sperm.position.x < 0) {
        player.sperm.position.x = 0;
        player.sperm.velocity.x = Math.abs(player.sperm.velocity.x) * 0.65;
        player.lastBounceAt = Date.now();
      } else if (player.sperm.position.x > this.worldBounds.width) {
        player.sperm.position.x = this.worldBounds.width;
        player.sperm.velocity.x = -Math.abs(player.sperm.velocity.x) * 0.65;
        player.lastBounceAt = Date.now();
      }
      if (player.sperm.position.y < 0) {
        player.sperm.position.y = 0;
        player.sperm.velocity.y = Math.abs(player.sperm.velocity.y) * 0.65;
        player.lastBounceAt = Date.now();
      } else if (player.sperm.position.y > this.worldBounds.height) {
        player.sperm.position.y = this.worldBounds.height;
        player.sperm.velocity.y = -Math.abs(player.sperm.velocity.y) * 0.65;
        player.lastBounceAt = Date.now();
      }

      // b. Trail collision
      const nearbyTrailPoints = this.grid.getNearby(player.sperm.position);
      const playerTrailLength = player.trail.length;
      const now = Date.now();
      const playerSpawnAt = player.spawnAtMs;
      const playerLastBounceAt = player.lastBounceAt;

      // Pre-calculate collision threshold squared to avoid sqrt
      const collisionThreshold = SPERM_COLLISION_RADIUS + TRAIL_COLLISION_RADIUS;
      const collisionThresholdSq = collisionThreshold * collisionThreshold;

      for (const entry of nearbyTrailPoints) {
        // Self-collision check (optimized with tracked index)
        if (entry.playerId === player.id) {
            const pointIndex = entry.pointIndex;
            if (pointIndex >= playerTrailLength - SELF_COLLISION_BUFFER) {
                continue; // Ignore recent self-trail points
            }
            // Additional fairness tolerances
            const createdAt = (entry.point as TrailPoint).createdAt || 0;
            if (createdAt && (now - createdAt) < SELF_IGNORE_RECENT_MS) {
              continue;
            }
            if ((now - playerSpawnAt) < SPAWN_SELF_COLLISION_GRACE_MS) {
              continue;
            }
            if (playerLastBounceAt && (now - playerLastBounceAt) < POST_BOUNCE_GRACE_MS) {
              continue;
            }
        }

        // Use squared distance to avoid expensive sqrt operation
        const dx = player.sperm.position.x - entry.point.x;
        const dy = player.sperm.position.y - entry.point.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < collisionThresholdSq) {
          const killerId = entry.playerId !== player.id ? entry.playerId : undefined;

          // Build debug segment if we can locate the neighbor point in killer's trail
          // Only compute debug info if actually needed (not in hot path for collision detection)
          let segment: { from: { x: number; y: number }; to: { x: number; y: number } } | undefined = undefined;
          if (killerId && players.has(killerId)) {
            try {
              const killer = players.get(killerId)!;
              const idx = entry.pointIndex;
              const prev = killer.trail[Math.max(0, idx - 1)];
              const from = prev || entry.point;
              const to = entry.point;
              segment = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
            } catch {}
          }

          // Compute collision normal and relative speed for debug telemetry
          const distance = Math.sqrt(distanceSq) || 1;
          const normal = { x: dx / distance, y: dy / distance };
          const relSpeed = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
          eliminated.push({ victimId: player.id, killerId, debug: { type: 'trail', hit: { x: player.sperm.position.x, y: player.sperm.position.y }, ...(segment ? { segment } : {}), normal, relSpeed } });
          break; // No need to check other points for this player
        }
      }
    }
    return eliminated;
  }

  /**
   * Checks and resolves direct body collisions between players.
   * - Pushes players apart to prevent overlap.
   * - Transfers momentum (elastic collision).
   * - Applies knockback if one player is lunging (combat mechanic).
   */
  checkPlayerCollisions(players: Map<string, PlayerEntity>): void {
    const playerList = Array.from(players.values()).filter(p => p.isAlive);
    const count = playerList.length;
    if (count < 2) return;

    // OPTIMIZATION: Use local Spatial Hashing to reduce complexity from O(N^2) to O(N)
    // This scales efficiently even with high player/bot counts.
    const grid = new Map<string, PlayerEntity[]>();
    const cellSize = GRID_CELL_SIZE; // Uses existing 100px cell size

    // 1. Build localized grid
    for (const p of playerList) {
      const cx = Math.floor(p.sperm.position.x / cellSize);
      const cy = Math.floor(p.sperm.position.y / cellSize);
      const key = `${cx},${cy}`;
      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      cell.push(p);
    }

    // 2. Check collisions with neighbors
    const radiusSum = SPERM_COLLISION_RADIUS * 2.5; 
    const radiusSumSq = radiusSum * radiusSum;

    for (const p1 of playerList) {
      const cx = Math.floor(p1.sperm.position.x / cellSize);
      const cy = Math.floor(p1.sperm.position.y / cellSize);

      // Check 3x3 grid neighborhood
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          const key = `${x},${y}`;
          const cell = grid.get(key);
          if (!cell) continue;

          for (const p2 of cell) {
            // Optimization: Ensure unique pairs (A vs B, not B vs A) and skip self
            if (p1.id >= p2.id) continue;
        
            const dx = p2.sperm.position.x - p1.sperm.position.x;
            const dy = p2.sperm.position.y - p1.sperm.position.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < radiusSumSq) {
              const dist = Math.sqrt(distSq);
              if (dist < 0.001) continue; // Avoid div by zero
              
              // 1. Resolve Overlap (Push apart)
              const overlap = radiusSum - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              
              const pushX = nx * overlap * 0.5;
              const pushY = ny * overlap * 0.5;
              
              p1.sperm.position.x -= pushX;
              p1.sperm.position.y -= pushY;
              p2.sperm.position.x += pushX;
              p2.sperm.position.y += pushY;
              
              // 2. Momentum Transfer (Elastic-ish)
              const v1n = p1.sperm.velocity.x * nx + p1.sperm.velocity.y * ny;
              const v2n = p2.sperm.velocity.x * nx + p2.sperm.velocity.y * ny;
              
              // Check lunge states
              const p1Lunge = p1.isLunging();
              const p2Lunge = p2.isLunging();
              
              if (p1Lunge && !p2Lunge) {
                // P1 attacks P2: P1 keeps going (mostly), P2 gets yeeted
                const ATTACK_FORCE = 800; // Bonus knockback
                p2.sperm.velocity.x += nx * ATTACK_FORCE;
                p2.sperm.velocity.y += ny * ATTACK_FORCE;
                // P1 slight slow down impact
                p1.sperm.velocity.x *= 0.8;
                p1.sperm.velocity.y *= 0.8;
              } else if (!p1Lunge && p2Lunge) {
                // P2 attacks P1
                const ATTACK_FORCE = 800;
                p1.sperm.velocity.x -= nx * ATTACK_FORCE;
                p1.sperm.velocity.y -= ny * ATTACK_FORCE;
                p2.sperm.velocity.x *= 0.8;
                p2.sperm.velocity.y *= 0.8;
              } else {
                // Standard bounce (both lunging or neither)
                const dv = v1n - v2n;
                if (dv > 0) { // Only bounce if moving towards each other
                    // restitution 0.8 = bouncy
                    const restitution = 0.8;
                    const impulse = (-(1 + restitution) * dv) / 2;
                    p1.sperm.velocity.x += impulse * nx;
                    p1.sperm.velocity.y += impulse * ny;
                    p2.sperm.velocity.x -= impulse * nx;
                    p2.sperm.velocity.y -= impulse * ny;
                }
              }
            }
          }
        }
      }
    }
  }
}
