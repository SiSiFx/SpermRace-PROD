import { PlayerEntity } from './Player.js';
import { Vector2, TrailPoint } from 'shared';
import { COLLISION as S_COLLISION } from 'shared/dist/constants.js';
import { LatencyCompensation } from './LatencyCompensation.js';

// =================================================================================================
// CONSTANTS
// =================================================================================================

const GRID_CELL_SIZE = S_COLLISION.GRID_CELL_SIZE;
const SPERM_COLLISION_RADIUS = S_COLLISION.SPERM_COLLISION_RADIUS;
const TRAIL_COLLISION_RADIUS = S_COLLISION.TRAIL_COLLISION_RADIUS;
const SELF_COLLISION_BUFFER = 20;
const SELF_IGNORE_RECENT_MS = S_COLLISION.SELF_IGNORE_RECENT_MS;
const SPAWN_SELF_COLLISION_GRACE_MS = S_COLLISION.SPAWN_SELF_COLLISION_GRACE_MS;

// =================================================================================================
// SPATIAL HASH GRID
// =================================================================================================

interface GridEntry {
  playerId: string;
  point: TrailPoint;
  pointIndex: number;
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
        const cell = this.grid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            nearbyEntries.push(cell[i]);
          }
        }
      }
    }
    return nearbyEntries;
  }
}

// =================================================================================================
// COLLISION SYSTEM - SLITHER.IO STYLE
// =================================================================================================

interface PositionOverride {
  x: number;
  y: number;
}

export interface CollisionResult {
  victimId: string;
  killerId?: string;
  debug?: {
    type: 'trail' | 'body';
    hit: { x: number; y: number };
    segment?: { from: { x: number; y: number }; to: { x: number; y: number } };
  };
}

export class CollisionSystem {
  private grid: SpatialHashGrid;
  private worldBounds: { width: number; height: number };
  private latencyCompensation: LatencyCompensation;

  constructor(worldWidth: number, worldHeight: number, latencyCompensation?: LatencyCompensation) {
    this.grid = new SpatialHashGrid(GRID_CELL_SIZE);
    this.worldBounds = { width: worldWidth, height: worldHeight };
    this.latencyCompensation = latencyCompensation || new LatencyCompensation();
  }

  getLatencyCompensation(): LatencyCompensation {
    return this.latencyCompensation;
  }

  setWorldBounds(width: number, height: number): void {
    this.worldBounds.width = width;
    this.worldBounds.height = height;
  }

  private getPlayerPosition(player: PlayerEntity, positionOverride?: PositionOverride): { x: number; y: number } {
    if (positionOverride) {
      return { x: positionOverride.x, y: positionOverride.y };
    }
    return { x: player.sperm.position.x, y: player.sperm.position.y };
  }

  /**
   * SLITHER.IO-STYLE: Head collision with ANYTHING = death
   * - Head vs Trail = Death
   * - Head vs Other Player's Body = Death  
   * - Head vs Wall = Death (not bounce)
   */
  updateWithLagCompensation(
    players: Map<string, PlayerEntity>,
    lagCompensatedPositions: Map<string, PositionOverride>
  ): CollisionResult[] {
    const eliminated: CollisionResult[] = [];
    const eliminatedIds = new Set<string>();

    // 1. Build trail grid
    this.grid.clear();
    for (const player of players.values()) {
      if (!player.isAlive) continue;
      const trail = player.trail;
      // Insert all trail points
      for (let i = 0; i < trail.length; i++) {
        this.grid.insert(player.id, trail[i], i);
      }
    }

    // 2. Check collisions for each alive player
    for (const player of players.values()) {
      if (!player.isAlive || eliminatedIds.has(player.id)) continue;

      const playerPos = this.getPlayerPosition(player, lagCompensatedPositions.get(player.id));
      const now = Date.now();
      const playerSpawnAt = player.spawnAtMs;

      // a. WALL COLLISION = DEATH (Slither.io style - no bouncing)
      const margin = SPERM_COLLISION_RADIUS;
      if (playerPos.x < margin || playerPos.x > this.worldBounds.width - margin ||
          playerPos.y < margin || playerPos.y > this.worldBounds.height - margin) {
        eliminated.push({ 
          victimId: player.id, 
          killerId: undefined,
          debug: { type: 'trail', hit: { x: playerPos.x, y: playerPos.y } }
        });
        eliminatedIds.add(player.id);
        continue;
      }

      // b. TRAIL COLLISION (including other players' bodies)
      const nearbyTrailPoints = this.grid.getNearby(playerPos);
      const playerTrailLength = player.trail.length;
      
      const collisionThreshold = SPERM_COLLISION_RADIUS + TRAIL_COLLISION_RADIUS;
      const collisionThresholdSq = collisionThreshold * collisionThreshold;

      let hit = false;
      
      for (const entry of nearbyTrailPoints) {
        // Self-collision checks
        if (entry.playerId === player.id) {
          const pointIndex = entry.pointIndex;
          if (pointIndex >= playerTrailLength - SELF_COLLISION_BUFFER) {
            continue;
          }
          const createdAt = (entry.point as TrailPoint).createdAt || 0;
          if (createdAt && (now - createdAt) < SELF_IGNORE_RECENT_MS) {
            continue;
          }
          if ((now - playerSpawnAt) < SPAWN_SELF_COLLISION_GRACE_MS) {
            continue;
          }
        }

        // Check distance
        const dx = playerPos.x - entry.point.x;
        const dy = playerPos.y - entry.point.y;
        const distanceSq = dx * dx + dy * dy;

        const compensatedRadius = this.latencyCompensation.getCompensatedCollisionRadius(player.id, collisionThreshold);
        const compensatedRadiusSq = compensatedRadius * compensatedRadius;

        if (distanceSq < compensatedRadiusSq) {
          const killerId = entry.playerId !== player.id ? entry.playerId : undefined;
          
          let segment: { from: { x: number; y: number }; to: { x: number; y: number } } | undefined;
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

          eliminated.push({ 
            victimId: player.id, 
            killerId,
            debug: { 
              type: 'trail', 
              hit: { x: playerPos.x, y: playerPos.y },
              ...(segment ? { segment } : {})
            }
          });
          eliminatedIds.add(player.id);
          hit = true;
          break;
        }
      }

      if (hit) continue;

      // c. DIRECT HEAD-TO-HEAD / BODY COLLISION (Slither.io style)
      // Check collision with other players' heads and bodies
      for (const other of players.values()) {
        if (!other.isAlive || other.id === player.id) continue;
        if (eliminatedIds.has(other.id)) continue;

        const otherPos = this.getPlayerPosition(other, lagCompensatedPositions.get(other.id));
        
        // Head-to-head collision
        const dx = playerPos.x - otherPos.x;
        const dy = playerPos.y - otherPos.y;
        const distSq = dx * dx + dy * dy;
        
        const headRadius = SPERM_COLLISION_RADIUS * 2; // Head-to-head
        const headRadiusSq = headRadius * headRadius;

        if (distSq < headRadiusSq) {
          // In Slither.io, smaller snake dies on head-to-head
          // We'll use velocity as tiebreaker (higher speed wins)
          const playerSpeed = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
          const otherSpeed = Math.hypot(other.sperm.velocity.x, other.sperm.velocity.y);
          
          const victim = playerSpeed < otherSpeed ? player : other;
          const killer = playerSpeed < otherSpeed ? other : player;
          
          if (!eliminatedIds.has(victim.id)) {
            eliminated.push({
              victimId: victim.id,
              killerId: killer.id,
              debug: { 
                type: 'body', 
                hit: { x: victim.sperm.position.x, y: victim.sperm.position.y }
              }
            });
            eliminatedIds.add(victim.id);
          }
          break;
        }
      }
    }

    return eliminated;
  }

  update(players: Map<string, PlayerEntity>): CollisionResult[] {
    return this.updateWithLagCompensation(players, new Map());
  }

  /**
   * DEPRECATED: No longer used - body collisions are deadly in Slither style
   * Kept for API compatibility
   */
  checkPlayerCollisions(_players: Map<string, PlayerEntity>): void {
    // In Slither.io, body collisions kill - no bouncing
    // This is now handled in updateWithLagCompensation
  }
}
