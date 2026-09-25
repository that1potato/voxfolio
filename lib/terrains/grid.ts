import type {
  BlockTypeDefinition,
  BlockTypeId,
  BlockTypesDoc,
  Terrain,
  TerrainBlock,
  TerrainBlockPosition,
  TerrainGrid,
  TerrainLayer,
  TerrainsDoc,
} from "./types";

export function getTerrain(d: TerrainsDoc, id: string): Terrain | undefined {
  return d.terrains.find((terrain) => terrain.id === id);
}

export function getBlockType(
  blockTypes: BlockTypesDoc,
  id: string,
): BlockTypeDefinition | undefined {
  return blockTypes.blockTypes.find((blockType) => blockType.id === id);
}

export function getGroundLayer(terrain: Terrain): TerrainLayer | undefined {
  return terrain.grid.layers.find((layer) => layer.y === 0);
}

export function layerToCells(
  layer: TerrainLayer | undefined,
  width: number,
  depth: number,
): Array<BlockTypeId | null> {
  const cells = Array<BlockTypeId | null>(width * depth).fill(null);
  if (!layer) return cells;
  Object.entries(layer.masks).forEach(([blockTypeId, rows]) => {
    for (let rowIndex = 0; rowIndex < depth; rowIndex++) {
      const row = rows[rowIndex] ?? "";
      for (let columnIndex = 0; columnIndex < width; columnIndex++) {
        if (row[columnIndex] === "1") {
          cells[rowIndex * width + columnIndex] = blockTypeId;
        }
      }
    }
  });
  return cells;
}

export function cellsToLayer(
  cells: ReadonlyArray<BlockTypeId | null>,
  width: number,
  depth: number,
  y = 0,
): TerrainLayer | null {
  const ids: string[] = [];
  const seen = new Set<string>();
  cells.forEach((cell) => {
    if (cell && !seen.has(cell)) {
      seen.add(cell);
      ids.push(cell);
    }
  });
  if (ids.length === 0) return null;

  const masks: Record<string, string[]> = {};
  ids.forEach((id) => {
    const rows: string[] = [];
    for (let rowIndex = 0; rowIndex < depth; rowIndex++) {
      let row = "";
      for (let columnIndex = 0; columnIndex < width; columnIndex++) {
        row += cells[rowIndex * width + columnIndex] === id ? "1" : "0";
      }
      rows.push(row);
    }
    masks[id] = rows;
  });
  return { y, masks };
}

function getGridCellAtWorldPosition(
  grid: TerrainGrid,
  x: number,
  z: number,
): { i: number; j: number; index: number } | null {
  const i = x - grid.originX;
  const j = z - grid.originZ;
  if (
    !Number.isInteger(i) ||
    !Number.isInteger(j) ||
    i < 0 ||
    i >= grid.width ||
    j < 0 ||
    j >= grid.depth
  ) {
    return null;
  }
  return { i, j, index: j * grid.width + i };
}

export function isTerrainBlockPositionInGrid(
  terrain: Terrain,
  position: TerrainBlockPosition,
): boolean {
  return (
    Number.isInteger(position[1]) &&
    getGridCellAtWorldPosition(terrain.grid, position[0], position[2]) !== null
  );
}

export function getTerrainBlockTypeId(
  terrain: Terrain,
  position: TerrainBlockPosition,
): BlockTypeId | null {
  const [x, y, z] = position;
  if (!Number.isInteger(y)) return null;
  const cell = getGridCellAtWorldPosition(terrain.grid, x, z);
  if (!cell) return null;
  const layer = terrain.grid.layers.find((candidate) => candidate.y === y);
  if (!layer) return null;

  for (const [blockTypeId, rows] of Object.entries(layer.masks)) {
    if (rows[cell.j]?.[cell.i] === "1") return blockTypeId;
  }
  return null;
}

export function getTerrainBlocks(terrain: Terrain): TerrainBlock[] {
  const blocks: TerrainBlock[] = [];
  const grid = terrain.grid;

  grid.layers.forEach((layer) => {
    Object.entries(layer.masks).forEach(([blockTypeId, rows]) => {
      for (let j = 0; j < grid.depth; j++) {
        const row = rows[j] ?? "";
        for (let i = 0; i < grid.width; i++) {
          if (row[i] !== "1") continue;
          blocks.push({
            position: [grid.originX + i, layer.y, grid.originZ + j],
            blockTypeId,
          });
        }
      }
    });
  });

  return blocks;
}

export function setTerrainBlock(
  terrain: Terrain,
  position: TerrainBlockPosition,
  blockTypeId: BlockTypeId | null,
): Terrain {
  const [x, y, z] = position;
  if (!Number.isInteger(y)) return terrain;
  const cell = getGridCellAtWorldPosition(terrain.grid, x, z);
  if (!cell) return terrain;
  if (getTerrainBlockTypeId(terrain, position) === blockTypeId) return terrain;

  const currentLayer = terrain.grid.layers.find((layer) => layer.y === y);
  const cells = layerToCells(
    currentLayer,
    terrain.grid.width,
    terrain.grid.depth,
  );
  cells[cell.index] = blockTypeId;
  const nextLayer = cellsToLayer(
    cells,
    terrain.grid.width,
    terrain.grid.depth,
    y,
  );
  const otherLayers = terrain.grid.layers.filter((layer) => layer.y !== y);

  return {
    ...terrain,
    grid: {
      ...terrain.grid,
      layers: nextLayer
        ? [...otherLayers, nextLayer].sort((a, b) => a.y - b.y)
        : otherLayers,
    },
  };
}

export function countTerrainBlocks(terrain: Terrain): Map<BlockTypeId, number> {
  const counts = new Map<BlockTypeId, number>();
  terrain.grid.layers.forEach((layer) => {
    Object.entries(layer.masks).forEach(([blockTypeId, rows]) => {
      let count = counts.get(blockTypeId) ?? 0;
      rows.forEach((row) => {
        for (const cell of row) {
          if (cell === "1") count++;
        }
      });
      counts.set(blockTypeId, count);
    });
  });
  return counts;
}

export function getDominantBlockTypeId(
  terrain: Terrain,
  blockTypes: BlockTypesDoc,
): BlockTypeId {
  const counts = countTerrainBlocks(terrain);
  let dominantId = blockTypes.defaultBlockTypeId;
  let dominantCount = 0;
  blockTypes.blockTypes.forEach((blockType) => {
    const count = counts.get(blockType.id) ?? 0;
    if (count > dominantCount) {
      dominantId = blockType.id;
      dominantCount = count;
    }
  });
  return dominantId;
}

export function getTerrainLayerRange(terrain: Terrain): { minY: number; maxY: number } {
  if (terrain.grid.layers.length === 0) return { minY: 0, maxY: 0 };
  let minY = terrain.grid.layers[0].y;
  let maxY = minY;
  terrain.grid.layers.forEach((layer) => {
    minY = Math.min(minY, layer.y);
    maxY = Math.max(maxY, layer.y);
  });
  return { minY, maxY };
}

export function cellToWorld(grid: TerrainGrid, i: number, j: number): [number, number] {
  return [grid.originX + i, grid.originZ + j];
}

export function terrainCenter(grid: TerrainGrid): [number, number] {
  return [grid.originX + (grid.width - 1) / 2, grid.originZ + (grid.depth - 1) / 2];
}

export interface TerrainXZBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Returns the XZ bounding box of all occupied voxels and element positions, or null if empty. */
export function getTerrainContentBounds(terrain: Terrain): TerrainXZBounds | null {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  const expand = (x: number, z: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  };

  for (const layer of terrain.grid.layers) {
    for (const [blockTypeId, rows] of Object.entries(layer.masks)) {
      if (!blockTypeId) continue;
      for (let j = 0; j < terrain.grid.depth; j++) {
        const row = rows[j] ?? "";
        for (let i = 0; i < terrain.grid.width; i++) {
          if (row[i] === "1") expand(terrain.grid.originX + i, terrain.grid.originZ + j);
        }
      }
    }
  }

  for (const el of terrain.elements) {
    expand(el.position[0], el.position[2]);
  }

  return minX === Infinity ? null : { minX, maxX, minZ, maxZ };
}

/**
 * Rebuild the terrain's grid to cover exactly [minX..maxX, minZ..maxZ].
 * All occupied blocks are re-indexed to the new origin; elements are untouched (world-space).
 */
export function reframeTerrainGrid(
  terrain: Terrain,
  bounds: TerrainXZBounds,
): Terrain {
  // Snap to integer cells: element positions (which feed the bounds) may be fractional,
  // and a fractional width/depth would produce an invalid Array length downstream.
  const minX = Math.floor(bounds.minX);
  const maxX = Math.ceil(bounds.maxX);
  const minZ = Math.floor(bounds.minZ);
  const maxZ = Math.ceil(bounds.maxZ);
  const newWidth = maxX - minX + 1;
  const newDepth = maxZ - minZ + 1;

  const nextLayers: TerrainLayer[] = terrain.grid.layers.map((layer) => {
    const masks: Record<string, string[]> = {};
    for (const [blockTypeId, rows] of Object.entries(layer.masks)) {
      const nextRows: string[] = Array.from({ length: newDepth }, () => "0".repeat(newWidth));
      for (let j = 0; j < terrain.grid.depth; j++) {
        const row = rows[j] ?? "";
        for (let i = 0; i < terrain.grid.width; i++) {
          if (row[i] !== "1") continue;
          const worldX = terrain.grid.originX + i;
          const worldZ = terrain.grid.originZ + j;
          const ni = worldX - minX;
          const nj = worldZ - minZ;
          if (ni >= 0 && ni < newWidth && nj >= 0 && nj < newDepth) {
            nextRows[nj] = nextRows[nj].slice(0, ni) + "1" + nextRows[nj].slice(ni + 1);
          }
        }
      }
      if (nextRows.some((r) => r.includes("1"))) masks[blockTypeId] = nextRows;
    }
    return { y: layer.y, masks };
  }).filter((layer) => Object.keys(layer.masks).length > 0);

  return {
    ...terrain,
    grid: { originX: minX, originZ: minZ, width: newWidth, depth: newDepth, layers: nextLayers },
  };
}

const MIN_GRID_SIZE = 4;

/**
 * Grow the grid to include world position [x, z], then re-pad to content + margin.
 * Use after placing a block outside current bounds.
 */
export function growTerrainToInclude(terrain: Terrain, x: number, z: number): Terrain {
  const curMinX = terrain.grid.originX;
  const curMaxX = terrain.grid.originX + terrain.grid.width - 1;
  const curMinZ = terrain.grid.originZ;
  const curMaxZ = terrain.grid.originZ + terrain.grid.depth - 1;
  if (x >= curMinX && x <= curMaxX && z >= curMinZ && z <= curMaxZ) return terrain;
  return reframeTerrainGrid(terrain, {
    minX: Math.min(curMinX, x),
    maxX: Math.max(curMaxX, x),
    minZ: Math.min(curMinZ, z),
    maxZ: Math.max(curMaxZ, z),
  });
}

/**
 * Shrink/expand the grid to exactly fit content bounding box + margin on all sides.
 * If the terrain is empty, returns a grid of size (margin*2+1) centered on the current center.
 */
export function fitTerrainToContent(terrain: Terrain, margin: number): Terrain {
  const content = getTerrainContentBounds(terrain);
  let minX: number, maxX: number, minZ: number, maxZ: number;
  if (content) {
    minX = content.minX - margin;
    maxX = content.maxX + margin;
    minZ = content.minZ - margin;
    maxZ = content.maxZ + margin;
  } else {
    const cx = terrain.grid.originX + Math.floor((terrain.grid.width - 1) / 2);
    const cz = terrain.grid.originZ + Math.floor((terrain.grid.depth - 1) / 2);
    const half = Math.max(margin, Math.floor(MIN_GRID_SIZE / 2));
    minX = cx - half; maxX = cx + half;
    minZ = cz - half; maxZ = cz + half;
  }
  // Ensure minimum size
  if (maxX - minX + 1 < MIN_GRID_SIZE) {
    const extra = MIN_GRID_SIZE - (maxX - minX + 1);
    maxX += extra;
  }
  if (maxZ - minZ + 1 < MIN_GRID_SIZE) {
    const extra = MIN_GRID_SIZE - (maxZ - minZ + 1);
    maxZ += extra;
  }
  return reframeTerrainGrid(terrain, { minX, maxX, minZ, maxZ });
}
