/**
 * Spatial Grid for O(1) spatial lookups
 * Divides the world into cells for efficient collision detection
 */

/**
 * Spatial cell containing entities
 */
interface SpatialCell {
  /** Entities in this cell */
  entities: Set<string>;

  /** Cell index (for quick access) */
  index: number;
}

/**
 * Grid coordinate
 */
export interface GridCoord {
  x: number;
  y: number;
}

/**
 * Entity spatial data
 */
interface EntitySpatialData {
  /** Entity ID */
  id: string;

  /** Current position */
  x: number;

  /** Current position */
  y: number;

  /** Collision radius */
  radius: number;

  /** Cells this entity currently occupies */
  cells: number[];
}

/**
 * Spatial grid configuration
 */
export interface SpatialGridConfig {
  /** Cell size in pixels */
  cellSize: number;

  /** World width */
  worldWidth: number;

  /** World height */
  worldHeight: number;

  /** Maximum entities to track */
  maxEntities: number;
}

/**
 * Spatial Grid for efficient spatial queries
 *
 * Benefits over O(n²) collision detection:
 * - Trail collision: O(n×m) → O(n) with spatial grid
 * - Car collision: O(n²) → O(n) with cell lookup
 * - Powerup pickup: O(n) → O(1)
 */
export class SpatialGrid {
  private readonly _cellSize: number;
  private readonly _worldWidth: number;
  private readonly _worldHeight: number;
  private readonly _gridCols: number;
  private readonly _gridRows: number;
  private readonly _cells: SpatialCell[];

  /** Entity spatial data */
  private readonly _entities: Map<string, EntitySpatialData> = new Map();

  /** Dirty flag for cells needing update */
  private readonly _dirtyCells: Set<number> = new Set();

  /** Current frame for tracking */
  private _currentFrame: number = 0;

  constructor(config: SpatialGridConfig) {
    this._cellSize = config.cellSize;
    this._worldWidth = config.worldWidth;
    this._worldHeight = config.worldHeight;
    this._gridCols = Math.ceil(config.worldWidth / config.cellSize);
    this._gridRows = Math.ceil(config.worldHeight / config.cellSize);

    // Initialize grid cells
    const totalCells = this._gridCols * this._gridRows;
    this._cells = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this._cells[i] = { entities: new Set(), index: i };
    }
  }

  /**
   * Add an entity to the grid
   */
  addEntity(id: string, x: number, y: number, radius: number): void {
    // Remove existing if present
    this.removeEntity(id);

    const cells = this._getCellsForCircle(x, y, radius);
    const data: EntitySpatialData = {
      id,
      x,
      y,
      radius,
      cells,
    };

    this._entities.set(id, data);

    // Add to cells
    for (const cellIndex of cells) {
      this._cells[cellIndex].entities.add(id);
    }
  }

  /**
   * Update an entity's position in the grid
   * Returns true if the entity's cells changed
   */
  updateEntity(id: string, x: number, y: number, radius?: number): boolean {
    const data = this._entities.get(id);
    if (!data) {
      this.addEntity(id, x, y, radius ?? 0);
      return true;
    }

    // Check if position changed significantly
    const dx = x - data.x;
    const dy = y - data.y;
    const distSq = dx * dx + dy * dy;

    // Only update if moved more than half cell size
    if (distSq < (this._cellSize * this._cellSize) / 4 && radius === undefined) {
      data.x = x;
      data.y = y;
      return false;
    }

    // Get new cells
    const newRadius = radius ?? data.radius;
    const newCells = this._getCellsForCircle(x, y, newRadius);

    // Check if cells changed
    if (this._cellsEqual(data.cells, newCells)) {
      data.x = x;
      data.y = y;
      return false;
    }

    // Remove from old cells
    for (const cellIndex of data.cells) {
      this._cells[cellIndex].entities.delete(id);
    }

    // Update data
    data.x = x;
    data.y = y;
    data.radius = newRadius;
    data.cells = newCells;

    // Add to new cells
    for (const cellIndex of newCells) {
      this._cells[cellIndex].entities.add(id);
    }

    return true;
  }

  /**
   * Remove an entity from the grid
   */
  removeEntity(id: string): boolean {
    const data = this._entities.get(id);
    if (!data) {
      return false;
    }

    // Remove from all cells
    for (const cellIndex of data.cells) {
      this._cells[cellIndex].entities.delete(id);
    }

    this._entities.delete(id);
    return true;
  }

  /**
   * Get all entities in cells intersecting a circle
   */
  queryCircle(x: number, y: number, radius: number, filter?: Set<string>): Set<string> {
    const result = new Set<string>();
    const cells = this._getCellsForCircle(x, y, radius);

    for (const cellIndex of cells) {
      const cell = this._cells[cellIndex];
      for (const id of cell.entities) {
        if (filter && filter.has(id)) continue;
        result.add(id);
      }
    }

    return result;
  }

  /**
   * Get all entities in a cell
   */
  getCellEntities(cellX: number, cellY: number): Set<string> {
    const index = this._getCellIndex(cellX, cellY);
    if (index < 0 || index >= this._cells.length) {
      return new Set();
    }
    return this._cells[index].entities;
  }

  /**
   * Get all entities in a rectangle region
   */
  queryRect(x: number, y: number, width: number, height: number): Set<string> {
    const result = new Set<string>();
    const startCell = this._worldToCell(x, y);
    const endCell = this._worldToCell(x + width, y + height);

    for (let cy = startCell.y; cy <= endCell.y; cy++) {
      for (let cx = startCell.x; cx <= endCell.x; cx++) {
        const index = this._getCellIndex(cx, cy);
        if (index >= 0 && index < this._cells.length) {
          for (const id of this._cells[index].entities) {
            result.add(id);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get nearby entities within a radius
   * (Uses circle query and filters by actual distance)
   */
  getNearbyEntities(x: number, y: number, radius: number, excludeIds?: Set<string>): Map<string, { x: number; y: number; radius: number }> {
    const candidates = this.queryCircle(x, y, radius, excludeIds);
    const result = new Map();

    const radiusSq = radius * radius;

    for (const id of candidates) {
      if (excludeIds?.has(id)) continue;

      const data = this._entities.get(id);
      if (!data) continue;

      const dx = data.x - x;
      const dy = data.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < radiusSq) {
        result.set(id, { x: data.x, y: data.y, radius: data.radius });
      }
    }

    return result;
  }

  /**
   * Check if two entities are in the same cell (or adjacent cells)
   */
  areEntitiesNearby(id1: string, id2: string): boolean {
    const data1 = this._entities.get(id1);
    const data2 = this._entities.get(id2);

    if (!data1 || !data2) {
      return false;
    }

    // Check if any cell overlaps
    for (const cell1 of data1.cells) {
      for (const cell2 of data2.cells) {
        if (cell1 === cell2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get entity data
   */
  getEntity(id: string): { x: number; y: number; radius: number } | undefined {
    const data = this._entities.get(id);
    if (!data) return undefined;
    return { x: data.x, y: data.y, radius: data.radius };
  }

  /**
   * Clear all entities from the grid
   */
  clear(): void {
    for (const cell of this._cells) {
      cell.entities.clear();
    }
    this._entities.clear();
    this._dirtyCells.clear();
  }

  /**
   * Get debug information
   */
  getDebugInfo(): {
    totalEntities: number;
    totalCells: number;
    occupiedCells: number;
    avgEntitiesPerCell: number;
    maxEntitiesInCell: number;
  } {
    let occupiedCells = 0;
    let maxEntitiesInCell = 0;
    let totalEntitiesInCells = 0;

    for (const cell of this._cells) {
      const count = cell.entities.size;
      if (count > 0) {
        occupiedCells++;
        totalEntitiesInCells += count;
        maxEntitiesInCell = Math.max(maxEntitiesInCell, count);
      }
    }

    return {
      totalEntities: this._entities.size,
      totalCells: this._cells.length,
      occupiedCells,
      avgEntitiesPerCell: occupiedCells > 0 ? totalEntitiesInCells / occupiedCells : 0,
      maxEntitiesInCell,
    };
  }

  /**
   * Get grid configuration
   */
  getConfig(): {
    cellSize: number;
    gridCols: number;
    gridRows: number;
    worldWidth: number;
    worldHeight: number;
  } {
    return {
      cellSize: this._cellSize,
      gridCols: this._gridCols,
      gridRows: this._gridRows,
      worldWidth: this._worldWidth,
      worldHeight: this._worldHeight,
    };
  }

  /**
   * Convert world position to grid coordinates
   */
  private _worldToCell(x: number, y: number): GridCoord {
    return {
      x: Math.floor(x / this._cellSize),
      y: Math.floor(y / this._cellSize),
    };
  }

  /**
   * Get cell index from grid coordinates
   */
  private _getCellIndex(cellX: number, cellY: number): number {
    // Clamp to valid range
    const cx = Math.max(0, Math.min(this._gridCols - 1, cellX));
    const cy = Math.max(0, Math.min(this._gridRows - 1, cellY));
    return cy * this._gridCols + cx;
  }

  /**
   * Get all cells that a circle intersects
   */
  private _getCellsForCircle(cx: number, cy: number, radius: number): number[] {
    const cells: number[] = [];

    // Calculate cell range
    const minX = Math.floor((cx - radius) / this._cellSize);
    const maxX = Math.ceil((cx + radius) / this._cellSize);
    const minY = Math.floor((cy - radius) / this._cellSize);
    const maxY = Math.ceil((cy + radius) / this._cellSize);

    // Add all cells in range
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const index = this._getCellIndex(x, y);
        if (index >= 0 && index < this._cells.length) {
          cells.push(index);
        }
      }
    }

    return cells;
  }

  /**
   * Check if two cell arrays are equal
   */
  private _cellsEqual(cells1: number[], cells2: number[]): boolean {
    if (cells1.length !== cells2.length) {
      return false;
    }

    // Sort and compare
    const sorted1 = [...cells1].sort((a, b) => a - b);
    const sorted2 = [...cells2].sort((a, b) => a - b);

    for (let i = 0; i < sorted1.length; i++) {
      if (sorted1[i] !== sorted2[i]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Create a default spatial grid for the game
 */
export function createSpatialGrid(worldWidth: number = 3500, worldHeight: number = 2500): SpatialGrid {
  return new SpatialGrid({
    cellSize: 100,
    worldWidth,
    worldHeight,
    maxEntities: 10000,
  });
}
