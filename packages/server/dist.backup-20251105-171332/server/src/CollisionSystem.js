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
class SpatialHashGrid {
    grid = new Map();
    cellSize;
    constructor(cellSize) {
        this.cellSize = cellSize;
    }
    getKey(position) {
        const cellX = Math.floor(position.x / this.cellSize);
        const cellY = Math.floor(position.y / this.cellSize);
        return `${cellX},${cellY}`;
    }
    clear() {
        this.grid.clear();
    }
    insert(playerId, point) {
        const key = this.getKey(point);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push({ playerId, point });
    }
    getNearby(position) {
        const nearbyEntries = [];
        const centerX = Math.floor(position.x / this.cellSize);
        const centerY = Math.floor(position.y / this.cellSize);
        for (let x = centerX - 1; x <= centerX + 1; x++) {
            for (let y = centerY - 1; y <= centerY + 1; y++) {
                const key = `${x},${y}`;
                if (this.grid.has(key)) {
                    nearbyEntries.push(...this.grid.get(key));
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
    grid;
    worldBounds;
    constructor(worldWidth, worldHeight) {
        this.grid = new SpatialHashGrid(GRID_CELL_SIZE);
        this.worldBounds = { width: worldWidth, height: worldHeight };
    }
    setWorldBounds(width, height) {
        this.worldBounds.width = width;
        this.worldBounds.height = height;
    }
    /**
     * Updates the collision system with the current player states and detects collisions.
     * @param players A map of all players in the game.
     * @returns A set of player IDs that were eliminated in this frame.
     */
    update(players) {
        const eliminated = [];
        // 1. Build the spatial grid from player trails
        this.grid.clear();
        for (const player of players.values()) {
            if (!player.isAlive)
                continue;
            player.trail.forEach(point => this.grid.insert(player.id, point));
        }
        // 2. Check for collisions for each player
        for (const player of players.values()) {
            if (!player.isAlive)
                continue;
            // a. World boundary collision -> bounce back with softer damping
            if (player.sperm.position.x < 0) {
                player.sperm.position.x = 0;
                player.sperm.velocity.x = Math.abs(player.sperm.velocity.x) * 0.65;
                player.lastBounceAt = Date.now();
            }
            else if (player.sperm.position.x > this.worldBounds.width) {
                player.sperm.position.x = this.worldBounds.width;
                player.sperm.velocity.x = -Math.abs(player.sperm.velocity.x) * 0.65;
                player.lastBounceAt = Date.now();
            }
            if (player.sperm.position.y < 0) {
                player.sperm.position.y = 0;
                player.sperm.velocity.y = Math.abs(player.sperm.velocity.y) * 0.65;
                player.lastBounceAt = Date.now();
            }
            else if (player.sperm.position.y > this.worldBounds.height) {
                player.sperm.position.y = this.worldBounds.height;
                player.sperm.velocity.y = -Math.abs(player.sperm.velocity.y) * 0.65;
                player.lastBounceAt = Date.now();
            }
            // b. Trail collision
            const nearbyTrailPoints = this.grid.getNearby(player.sperm.position);
            for (const entry of nearbyTrailPoints) {
                // Self-collision check
                if (entry.playerId === player.id) {
                    const playerTrail = player.trail;
                    const pointIndex = playerTrail.indexOf(entry.point);
                    if (pointIndex >= playerTrail.length - SELF_COLLISION_BUFFER) {
                        continue; // Ignore recent self-trail points
                    }
                    // Additional fairness tolerances
                    const now = Date.now();
                    const createdAt = entry.point.createdAt || 0;
                    if (createdAt && (now - createdAt) < SELF_IGNORE_RECENT_MS) {
                        continue;
                    }
                    if ((now - player.spawnAtMs) < SPAWN_SELF_COLLISION_GRACE_MS) {
                        continue;
                    }
                    if (player.lastBounceAt && (now - player.lastBounceAt) < POST_BOUNCE_GRACE_MS) {
                        continue;
                    }
                }
                const distance = Math.sqrt((player.sperm.position.x - entry.point.x) ** 2 +
                    (player.sperm.position.y - entry.point.y) ** 2);
                if (distance < SPERM_COLLISION_RADIUS + TRAIL_COLLISION_RADIUS) {
                    const killerId = entry.playerId !== player.id ? entry.playerId : undefined;
                    // Build debug segment if we can locate the neighbor point in killer's trail
                    let segment = undefined;
                    if (killerId && players.has(killerId)) {
                        try {
                            const killer = players.get(killerId);
                            const idx = killer.trail.indexOf(entry.point);
                            if (idx >= 0) {
                                const prev = killer.trail[Math.max(0, idx - 1)];
                                const from = prev || entry.point;
                                const to = entry.point;
                                segment = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
                            }
                        }
                        catch { }
                    }
                    // Compute collision normal and relative speed for debug telemetry
                    const nxRaw = player.sperm.position.x - entry.point.x;
                    const nyRaw = player.sperm.position.y - entry.point.y;
                    const nLen = Math.hypot(nxRaw, nyRaw) || 1;
                    const normal = { x: nxRaw / nLen, y: nyRaw / nLen };
                    const relSpeed = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
                    eliminated.push({ victimId: player.id, killerId, debug: { type: 'trail', hit: { x: player.sperm.position.x, y: player.sperm.position.y }, ...(segment ? { segment } : {}), normal, relSpeed } });
                    break; // No need to check other points for this player
                }
            }
        }
        return eliminated;
    }
}
