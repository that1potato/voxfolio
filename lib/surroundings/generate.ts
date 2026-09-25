import {
  getTerrainContentBounds,
  type Terrain,
  type TerrainGrid,
  type TerrainLayer,
} from "@/lib/terrains";
import type { ThemeColorPair } from "@/lib/theme-colors";
import type { GeneratedSurroundings } from "./types";

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 + xmur3 string hash
// Produces identical output across machines given the same seed.
// ---------------------------------------------------------------------------

function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (((h ^ (h >>> 16)) >>> 0) * 2246822507) ^ (((h ^ (h >>> 16)) >>> 0) >>> 13);
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// Seed-varying smooth bilinear noise — incorporates seed so different seeds
// produce distinct coastline shapes / plateau patterns.
function smoothNoise(seed: number, x: number, z: number, scale: number): number {
  const sx = x * scale;
  const sz = z * scale;
  const gx = Math.floor(sx);
  const gz = Math.floor(sz);
  const fx = sx - gx;
  const fz = sz - gz;
  const h = (ix: number, iz: number) => mulberry32(xmur3(`${seed}:${ix}:${iz}`))();
  const v00 = h(gx, gz);
  const v10 = h(gx + 1, gz);
  const v01 = h(gx, gz + 1);
  const v11 = h(gx + 1, gz + 1);
  const sx2 = fx * fx * (3 - 2 * fx);
  const sz2 = fz * fz * (3 - 2 * fz);
  return v00 + sx2 * (v10 - v00) + sz2 * (v01 - v00) + sx2 * sz2 * (v00 - v10 - v01 + v11);
}

// Per-cell stable hash — deterministic from seed + position without consuming
// from the sequential rng, so decoration placement doesn't depend on iteration order.
function cellHash(seed: number, wx: number, wz: number): number {
  return mulberry32(xmur3(`${seed}:${wx}:${wz}`))();
}

// ---------------------------------------------------------------------------
// Default palette — self-contained; does NOT reference block-types.json.
// A soft meadow look; override any key via `SurroundingsOptions.palette`
// (e.g. an atmosphere preset's `surroundings` palette). The merged palette is
// embedded in the output JSON.
// ---------------------------------------------------------------------------

const PALETTE: Record<string, ThemeColorPair> = {
  // Gradient ring — three steps from the build-area edge outward.
  "grass-edge":    { light: "#d8e8cc", dark: "#809074" },
  "grass-mid":     { light: "#b4ccaa", dark: "#6a8464" },
  grass:           { light: "#8fb88a", dark: "#557050" },
  // Cliff and rock for column fill and tall peaks.
  cliff:           { light: "#a08070", dark: "#6a5448" },
  rock:            { light: "#909090", dark: "#606060" },
  // Coast and water.
  sand:            { light: "#d8c4a4", dark: "#a89070" },
  // Underwater shelf and inland pond floors — visible through the transparent water plane.
  seabed:          { light: "#7a9878", dark: "#3c5a3c" },
  // Decorations.
  trunk:           { light: "#956e56", dark: "#7a5240" },
  leaf:            { light: "#78a874", dark: "#4a6448" },
  blossom:         { light: "#f2c7c7", dark: "#c89090" },
  "blossom-light": { light: "#fce8e8", dark: "#d8a8a8" },
  flower:          { light: "#f8d06e", dark: "#c8a840" },
};

// ---------------------------------------------------------------------------
// Island geometry constants
// ---------------------------------------------------------------------------

// Base distance from active-rect edge to the coastline (cells).
const COAST_BASE = 22;
// Max organic variation in coastline distance driven by smooth noise.
const COAST_AMP = 8;
// Sandy beach width just inside the water edge.
const BEACH_WIDTH = 4;
// Total grid half-extent from the active rect on each side.
const MARGIN = 38;

// Offshore shelf: each SHELF_STEP cells seaward drops one Y level below water.
const SHELF_STEP = 4;
// Deepest shelf Y (SEABED_MIN < 0). Shelf stops emitting voxels beyond this depth.
const SEABED_MIN = -3;
// Total offshore reach (cells) that gets seabed voxels.
const SHELF_EXTENT = SHELF_STEP * (-SEABED_MIN); // 12 cells

// Rolling terrain: HILL_AMP is the max deviation above/below the island base.
// BASE_LAND is the target average surface height inland.
const HILL_AMP = 2.5;
const BASE_LAND = 1.5;
// Distance from beach edge to where hills reach full amplitude.
const INLAND_RAMP = 12;

// Build clearing: user-placed blocks sit in a flat zone, then blend outward.
const CLEAR_RADIUS = 4;  // cells of absolute flat around any placed block
const CLEAR_BLEND  = 5;  // additional cells of smooth blend to full terrain
const BFS_CAP = CLEAR_RADIUS + CLEAR_BLEND; // = 9 — BFS stops propagating past this

// Euclidean distance from the nearest point on the active-rect boundary.
// Returns 0 for points inside the rect (all interior cells are equidistant = 0).
function distToEdge(
  wx: number, wz: number,
  pMinX: number, pMaxX: number, pMinZ: number, pMaxZ: number,
): number {
  const dx = Math.max(pMinX - wx, 0, wx - pMaxX);
  const dz = Math.max(pMinZ - wz, 0, wz - pMaxZ);
  return Math.sqrt(dx * dx + dz * dz);
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

// Default for `SurroundingsOptions.blossomBias`.
const DEFAULT_BLOSSOM_BIAS = 0.3;

export interface SurroundingsOptions {
  seed?: number;
  /**
   * 0..1 — how strongly copses favour blossom trees over green trees
   * (default 0.3). At 0 about 20% of copse sites grow a blossom tree; at 1
   * about 40%.
   */
  blossomBias?: number;
  /** Colors merged over the default palette, keyed by palette key. */
  palette?: Record<string, ThemeColorPair>;
}

export function generateSurroundings(
  terrain: Terrain,
  opts: SurroundingsOptions = {},
): GeneratedSurroundings {
  const { grid } = terrain;
  const seed = opts.seed ?? (xmur3(terrain.id) >>> 0);
  const palette: Record<string, ThemeColorPair> = { ...PALETTE, ...opts.palette };
  const rawBias = opts.blossomBias ?? DEFAULT_BLOSSOM_BIAS;
  const blossomBias = Number.isFinite(rawBias)
    ? Math.min(1, Math.max(0, rawBias))
    : DEFAULT_BLOSSOM_BIAS;

  const outerMinX = grid.originX - MARGIN;
  const outerMaxX = grid.originX + grid.width - 1 + MARGIN;
  const outerMinZ = grid.originZ - MARGIN;
  const outerMaxZ = grid.originZ + grid.depth - 1 + MARGIN;
  const outerWidth = outerMaxX - outerMinX + 1;
  const outerDepth = outerMaxZ - outerMinZ + 1;

  // Build per-cell occupancy from the active terrain (any y, any block type).
  // Only cells with actual user-placed blocks are protected — every other cell
  // (the auto-resize margin, internal holes the user digs out, etc.) is fair
  // game for surroundings fill.
  const occupiedXZ = new Set<string>();
  for (const layer of grid.layers) {
    for (const rows of Object.values(layer.masks)) {
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        for (let i = 0; i < row.length; i++) {
          if (row[i] === "1") occupiedXZ.add(`${grid.originX + i},${grid.originZ + j}`);
        }
      }
    }
  }

  function isProtected(wx: number, wz: number): boolean {
    return occupiedXZ.has(`${wx},${wz}`);
  }

  // Content bounds drive the coast distance field — tells the generator where
  // the "centre" of the build is. Interior cells (inside bbox) have dEdge = 0
  // and therefore the largest shore values, ensuring they're always treated as
  // inland land, never as coast or water.
  const contentBounds = getTerrainContentBounds(terrain);
  const pMinX = contentBounds?.minX ?? grid.originX;
  const pMaxX = contentBounds?.maxX ?? (grid.originX + grid.width - 1);
  const pMinZ = contentBounds?.minZ ?? grid.originZ;
  const pMaxZ = contentBounds?.maxZ ?? (grid.originZ + grid.depth - 1);

  // ---------------------------------------------------------------------------
  // BFS distance-to-placed-block (capped at BFS_CAP).
  //
  // Seeds from every user-placed cell and spreads outward. The result tells us
  // how far each outer cell is from any authored block. Critically, this is
  // non-zero inside dug-out holes — so interior gaps receive rolling terrain
  // rather than being forced flat as they were when we only used distToEdge.
  // ---------------------------------------------------------------------------
  const dPlacedArr = new Float32Array(outerWidth * outerDepth).fill(BFS_CAP + 1);
  const bfsQueue: number[] = []; // encoded as (j * outerWidth + i)
  let bfsHead = 0;

  for (let j = 0; j < outerDepth; j++) {
    for (let i = 0; i < outerWidth; i++) {
      if (isProtected(outerMinX + i, outerMinZ + j)) {
        dPlacedArr[j * outerWidth + i] = 0;
        bfsQueue.push(j * outerWidth + i);
      }
    }
  }

  while (bfsHead < bfsQueue.length) {
    const idx = bfsQueue[bfsHead++];
    const ci = idx % outerWidth;
    const cj = Math.floor(idx / outerWidth);
    const cd = dPlacedArr[idx];
    if (cd >= BFS_CAP) continue;
    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || ni >= outerWidth || nj < 0 || nj >= outerDepth) continue;
      const nidx = nj * outerWidth + ni;
      if (dPlacedArr[nidx] > cd + 1) {
        dPlacedArr[nidx] = cd + 1;
        bfsQueue.push(nidx);
      }
    }
  }

  function getDPlaced(wx: number, wz: number): number {
    const i = wx - outerMinX;
    const j = wz - outerMinZ;
    if (i < 0 || i >= outerWidth || j < 0 || j >= outerDepth) return BFS_CAP + 1;
    return dPlacedArr[j * outerWidth + i];
  }

  // ---------------------------------------------------------------------------
  // Per-cell coast and height helpers.
  // ---------------------------------------------------------------------------

  // Noisy coastline radius — organic blobby edge shape.
  function getCoast(wx: number, wz: number): number {
    const n = smoothNoise(seed, wx, wz, 0.04);
    return COAST_BASE + (n * 2 - 1) * COAST_AMP;
  }

  // Multi-octave fbm height field in [0, 1].
  // Uses seed offsets 20–22 (not used by any other helper).
  function getFbm(wx: number, wz: number): number {
    return (
      smoothNoise(seed + 20, wx, wz, 0.045) * 0.60 +
      smoothNoise(seed + 21, wx, wz, 0.09)  * 0.30 +
      smoothNoise(seed + 22, wx, wz, 0.18)  * 0.10
    );
  }

  // Continuous land height for cells past the beach (shore >= BEACH_WIDTH).
  // Returns a float; callers round to integer Y.
  // Range after ramp: [-HILL_AMP, BASE_LAND + HILL_AMP] ≈ [-2.5, 4.0]
  // Negative values = potential inland ponds.
  function getLandHeight(wx: number, wz: number, shore: number): number {
    const fbm  = getFbm(wx, wz);
    const hills = HILL_AMP * (fbm * 2 - 1); // signed deviation in [-HILL_AMP, +HILL_AMP]

    // Ramp from 0 at the beach edge to 1 further inland.
    // Multiplying everything by ramp ensures H ≈ 0 right at the coast
    // so there's no abrupt height jump at the beach/land boundary.
    const ramp = Math.min((shore - BEACH_WIDTH) / INLAND_RAMP, 1);
    let H = (BASE_LAND + hills) * ramp;

    // Build clearing: flatten near user-placed blocks so authored builds sit
    // in a smooth flat zone, then blend back to terrain over CLEAR_BLEND cells.
    const dp = getDPlaced(wx, wz);
    if (dp <= CLEAR_RADIUS) {
      H = 0;
    } else if (dp < CLEAR_RADIUS + CLEAR_BLEND) {
      const t  = (dp - CLEAR_RADIUS) / CLEAR_BLEND;
      const st = t * t * (3 - 2 * t); // smoothstep
      H = H * st;
    }

    return H;
  }

  // Cap block color based on height — grass variants below, rock/cliff at peaks.
  function getCapColor(wx: number, wz: number, h: number): string {
    if (h >= 4) return cellHash(seed + 30, wx, wz) > 0.45 ? "rock"  : "cliff";
    if (h === 3) return cellHash(seed + 31, wx, wz) > 0.55 ? "cliff" : "grass";
    if (h === 2) return "grass";
    // h === 1 — use the same noise as the ring color so the h=0→h=1 boundary blends.
    return smoothNoise(seed + 13, wx, wz, 0.22) > 0.5 ? "grass" : "grass-mid";
  }

  // Cell accumulator: "wx,wy,wz" → palette key
  const cells = new Map<string, string>();

  function place(wx: number, wy: number, wz: number, pk: string) {
    if (isProtected(wx, wz)) return;
    cells.set(`${wx},${wy},${wz}`, pk);
  }

  // ---------------------------------------------------------------------------
  // Ground pass: emit land columns, beach, and underwater shelf.
  // ---------------------------------------------------------------------------
  for (let wz = outerMinZ; wz <= outerMaxZ; wz++) {
    for (let wx = outerMinX; wx <= outerMaxX; wx++) {
      if (isProtected(wx, wz)) continue;

      const dEdge = distToEdge(wx, wz, pMinX, pMaxX, pMinZ, pMaxZ);
      const coast = getCoast(wx, wz);
      const shore = coast - dEdge; // > 0 = inland, < 0 = offshore

      // ---- Offshore zone -------------------------------------------------------
      if (shore < 0) {
        // Skip cells too far out (beyond the shelf extent = deep water).
        if (shore < -SHELF_EXTENT) continue;
        // Stepped shelf: y = -1, -2, -3 as distance from coast increases.
        const depth = -shore;
        const step = Math.floor(depth / SHELF_STEP);
        const seabedY = Math.max(-(step + 1), SEABED_MIN);
        place(wx, seabedY, wz, "seabed");
        continue;
      }

      // ---- Beach zone ----------------------------------------------------------
      if (shore < BEACH_WIDTH) {
        place(wx, 0, wz, "sand");
        continue;
      }

      // ---- Land zone -----------------------------------------------------------
      const Hraw = getLandHeight(wx, wz, shore);
      const h    = Math.round(Hraw);

      if (h < 0) {
        // Inland pond — depression below water level (occasional, driven by noise).
        place(wx, h, wz, "seabed");
      } else if (h === 0) {
        // Flat ground — tint based on distance to placed blocks for a soft gradient
        // from pale sage (near the build) to full island green (far away).
        const dp        = getDPlaced(wx, wz);
        const ringNoise = smoothNoise(seed + 13, wx, wz, 0.22);
        const nd        = dp + (ringNoise - 0.5) * 2.8;
        const ringKey   = nd <= 1.4 ? "grass-edge" : nd <= 2.8 ? "grass-mid" : "grass";
        place(wx, 0, wz, ringKey);
      } else {
        // Raised land: grass/rock cap with solid cliff columns below.
        place(wx, h, wz, getCapColor(wx, wz, h));
        for (let y = 0; y < h; y++) place(wx, y, wz, "cliff");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Decorations — jittered-grid sampling on raised land cells only.
  // ---------------------------------------------------------------------------
  const DECO_SPACING = 5;

  for (let gz = outerMinZ + 2; gz <= outerMaxZ - 2; gz += DECO_SPACING) {
    for (let gx = outerMinX + 2; gx <= outerMaxX - 2; gx += DECO_SPACING) {
      const jr = mulberry32(xmur3(`${seed}:j:${gx}:${gz}`));
      const wx = gx + Math.floor(jr() * DECO_SPACING);
      const wz = gz + Math.floor(jr() * DECO_SPACING);

      if (isProtected(wx, wz)) continue;

      const dEdge = distToEdge(wx, wz, pMinX, pMaxX, pMinZ, pMaxZ);
      const coast = getCoast(wx, wz);
      const shore = coast - dEdge;

      // Only decorate raised land — not water, beach, or the clearing skirt.
      if (shore < BEACH_WIDTH) continue;
      if (getDPlaced(wx, wz) <= CLEAR_RADIUS + CLEAR_BLEND) continue;

      const h = Math.round(getLandHeight(wx, wz, shore));

      // Skip ponds and flat cells.
      if (h < 1) continue;
      // Confirm the land cell was placed in the ground pass.
      if (!cells.has(`${wx},${h},${wz}`)) continue;

      // Low-freq density field → copse clusters vs. open meadows.
      const density = smoothNoise(seed + 7, wx, wz, 0.1);
      const roll    = cellHash(seed + 3, wx, wz);

      if (density > 0.6) {
        // Copse — trees and rocks.
        if (roll < 0.2 + blossomBias * 0.2) {
          // Blossom tree: trunk + blossom canopy.
          place(wx, h + 1, wz, "trunk");
          place(wx, h + 2, wz, "blossom");
          if (cellHash(seed + 4, wx, wz) > 0.4) place(wx, h + 3, wz, "blossom-light");
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
            if (cellHash(seed + 5, wx + dx * 13, wz + dz * 7) > 0.45)
              place(wx + dx, h + 2, wz + dz, "blossom-light");
          }
        } else if (roll < 0.55) {
          // Green tree: trunk + leaf canopy.
          place(wx, h + 1, wz, "trunk");
          place(wx, h + 2, wz, "leaf");
          if (cellHash(seed + 6, wx, wz) > 0.35) place(wx, h + 3, wz, "leaf");
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
            if (cellHash(seed + 8, wx + dx * 11, wz + dz * 5) > 0.5)
              place(wx + dx, h + 2, wz + dz, "leaf");
          }
        } else if (roll < 0.72) {
          // Rock cluster.
          place(wx, h + 1, wz, "rock");
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
            if (cellHash(seed + 9, wx + dx * 17, wz + dz * 3) > 0.65)
              place(wx + dx, h + 1, wz + dz, "rock");
          }
        }
        // Remaining ~28%: open space inside copse.
      } else if (density > 0.4) {
        // Transition zone — light accents only.
        if (roll < 0.07) place(wx, h + 1, wz, "flower");
        else if (roll < 0.12) place(wx, h + 1, wz, "rock");
      }
      // Open zone (density < 0.4): leave bare.
    }
  }

  // ---------------------------------------------------------------------------
  // Convert cells → TerrainGrid
  // ---------------------------------------------------------------------------
  const byY = new Map<number, Map<string, Set<string>>>();

  for (const [key, pk] of cells) {
    const [wxStr, wyStr, wzStr] = key.split(",");
    const wx = parseInt(wxStr, 10);
    const wy = parseInt(wyStr, 10);
    const wz = parseInt(wzStr, 10);
    if (!byY.has(wy)) byY.set(wy, new Map());
    const layer = byY.get(wy)!;
    if (!layer.has(pk)) layer.set(pk, new Set());
    layer.get(pk)!.add(`${wx},${wz}`);
  }

  const layers: TerrainLayer[] = [];
  for (const [y, pkMap] of byY) {
    const masks: Record<string, string[]> = {};
    for (const [pk, positions] of pkMap) {
      const rows: string[] = Array.from({ length: outerDepth }, () => "0".repeat(outerWidth));
      for (const pos of positions) {
        const [wxStr, wzStr] = pos.split(",");
        const i = parseInt(wxStr, 10) - outerMinX;
        const j = parseInt(wzStr, 10) - outerMinZ;
        if (i >= 0 && i < outerWidth && j >= 0 && j < outerDepth)
          rows[j] = rows[j].slice(0, i) + "1" + rows[j].slice(i + 1);
      }
      if (rows.some((r) => r.includes("1"))) masks[pk] = rows;
    }
    if (Object.keys(masks).length > 0) layers.push({ y, masks });
  }
  layers.sort((a, b) => a.y - b.y);

  const surroundingsGrid: TerrainGrid = {
    originX: outerMinX,
    originZ: outerMinZ,
    width: outerWidth,
    depth: outerDepth,
    layers,
  };

  return {
    version: 2,
    sourceTerrainId: terrain.id,
    source: {
      originX: grid.originX,
      originZ: grid.originZ,
      width: grid.width,
      depth: grid.depth,
    },
    seed,
    palette,
    grid: surroundingsGrid,
  };
}
