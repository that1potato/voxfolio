import { useEffect, useState } from "react";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { getDefaultMapCameraFrame, MAP_CAMERA_FOV } from "./AmbientCamera";
import {
  TERRAIN_REVEAL_HEIGHT_DELAY,
  TERRAIN_REVEAL_RADIUS_PAD,
  type RevealOrigin,
} from "@/lib/radial-reveal";
import {
  getTerrainBlocks,
  getTerrainLayerRange,
  type Terrain as TerrainData,
  type TerrainGrid,
} from "@/lib/terrains";
import type { GeneratedSurroundings } from "@/lib/surroundings/types";

/**
 * Geometry + reveal-radius helpers for `VoxelMap`, plus the shared transition
 * descriptor. Pure (aside from the reduced-motion media-query hook) so the map
 * component stays focused on orchestration. The reveal math mirrors the shader
 * in `lib/radial-reveal.ts` exactly — see comments inline.
 */

export interface XZBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TerrainRevealTransition {
  key: number;
  durationMs: number;
  fromTerrain: TerrainData;
  toTerrain: TerrainData;
  fromSurroundings: GeneratedSurroundings | null;
  toSurroundings: GeneratedSurroundings | null;
  origin: RevealOrigin;
  maxRadius: number;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function expandBounds(bounds: XZBounds | null, next: XZBounds): XZBounds {
  if (!bounds) return next;
  return {
    minX: Math.min(bounds.minX, next.minX),
    maxX: Math.max(bounds.maxX, next.maxX),
    minZ: Math.min(bounds.minZ, next.minZ),
    maxZ: Math.max(bounds.maxZ, next.maxZ),
  };
}

export function getGridBounds(grid: TerrainGrid): XZBounds {
  return {
    minX: grid.originX,
    maxX: grid.originX + grid.width - 1,
    minZ: grid.originZ,
    maxZ: grid.originZ + grid.depth - 1,
  };
}

/**
 * Farthest visible point of the ground plane (y = 0) from the reveal origin,
 * unprojected through the actual map camera framings for the current viewport.
 * The radial reveal must reach this so no uncovered corner of old water/terrain
 * is ever left showing, regardless of viewport size/ratio or where the origin
 * sits. Sampled at both terrains' framings plus the midpoint to cover the lerp.
 */
export function getViewportCoverageRadius(
  origin: RevealOrigin,
  terrains: TerrainData[],
  width: number,
  height: number,
): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0;
  }

  const frames = terrains
    .map((terrain) => getDefaultMapCameraFrame(terrain, width, height))
    .filter((frame): frame is NonNullable<typeof frame> => frame !== null);
  if (frames.length === 0) return 0;

  const cam = new PerspectiveCamera(MAP_CAMERA_FOV, width / height, 0.1, 4000);
  const raycaster = new Raycaster();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3();
  const corners = [
    new Vector2(-1, -1),
    new Vector2(1, -1),
    new Vector2(-1, 1),
    new Vector2(1, 1),
  ];

  let maxDist = 0;
  const sampleAt = (position: Vector3, target: Vector3) => {
    cam.position.copy(position);
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    corners.forEach((corner) => {
      raycaster.setFromCamera(corner, cam);
      // Corners aimed at the sky miss the plane — those show only the (uniformly
      // crossfading) backdrop, never a hard reveal arc, so they need no coverage.
      if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
      // Quantise to the same floor()+0.5 cell the reveal shader discards against,
      // so the radius is measured to the exact boundary the GPU uses.
      const cellX = Math.floor(hit.x) + 0.5;
      const cellZ = Math.floor(hit.z) + 0.5;
      const dist = Math.hypot(cellX - origin[0], cellZ - origin[2]);
      if (dist > maxDist) maxDist = dist;
    });
  };

  // The camera travels the straight segment lerp(from -> to); the farthest visible
  // corner can peak mid-path, so sample the segment densely (not just endpoints) or
  // a one-cell sliver slips through near a corner.
  const pos = new Vector3();
  const tgt = new Vector3();
  const STEPS = 12;
  for (let i = 0; i < frames.length; i++) {
    const next = frames[i + 1];
    if (!next) {
      sampleAt(frames[i].position, frames[i].target);
      continue;
    }
    for (let s = 0; s <= STEPS; s++) {
      const u = s / STEPS;
      pos.lerpVectors(frames[i].position, next.position, u);
      tgt.lerpVectors(frames[i].target, next.target, u);
      sampleAt(pos, tgt);
    }
  }

  return maxDist;
}

export function getRevealMaxRadius(
  origin: RevealOrigin,
  scenes: Array<{
    terrain: TerrainData;
    surroundings: GeneratedSurroundings | null;
  }>,
  viewport: { width: number; height: number },
) {
  // Farthest *effective* reveal distance — the level the radius must reach for the
  // last voxel to finish blooming. Mirror the shader exactly: cell center =
  // floor(pos)+0.5, plus the per-column height delay baked into vRevealDistance.
  // The top block of each column carries that column's max height, so iterating
  // every block and taking the max captures both far-flat-edge and tall-interior
  // cases without over-padding (which would leave the radius racing through empty
  // space while the camera is still moving).
  let maxDist = 0;
  const consider = (
    blocks: ReturnType<typeof getTerrainBlocks>,
    heightDelay: number,
  ) => {
    blocks.forEach((block) => {
      const cellX = Math.floor(block.position[0]) + 0.5;
      const cellZ = Math.floor(block.position[2]) + 0.5;
      const dist =
        Math.hypot(cellX - origin[0], cellZ - origin[2]) +
        block.position[1] * heightDelay;
      if (dist > maxDist) maxDist = dist;
    });
  };

  scenes.forEach(({ terrain, surroundings }) => {
    consider(getTerrainBlocks(terrain), TERRAIN_REVEAL_HEIGHT_DELAY);
    if (surroundings) {
      // Surroundings don't carry a reveal height (flat border), so no delay.
      consider(
        getTerrainBlocks({
          id: "",
          label: "",
          grid: surroundings.grid,
          elements: [],
        }),
        0,
      );
    }
  });

  // Also reach the farthest visible ground point so no uncovered corner of the
  // outgoing scene is left showing for any viewport ratio.
  const coverage = getViewportCoverageRadius(
    origin,
    scenes.map((scene) => scene.terrain),
    viewport.width,
    viewport.height,
  );

  // Pad covers the trailing bloom band so the farthest voxel reaches full size
  // right as progress hits 1 (TERRAIN_REVEAL_RADIUS_PAD >= TERRAIN_REVEAL_BAND).
  return Math.max(maxDist, coverage) + TERRAIN_REVEAL_RADIUS_PAD;
}

function getGridLayerRange(grid: TerrainGrid) {
  if (grid.layers.length === 0) return { minY: 0, maxY: 0 };
  return grid.layers.reduce(
    (range, layer) => ({
      minY: Math.min(range.minY, layer.y),
      maxY: Math.max(range.maxY, layer.y),
    }),
    { minY: grid.layers[0].y, maxY: grid.layers[0].y },
  );
}

export function getUnionShadowTerrain(
  transition: TerrainRevealTransition,
): TerrainData {
  const grids = [
    transition.fromTerrain.grid,
    transition.toTerrain.grid,
    transition.fromSurroundings?.grid,
    transition.toSurroundings?.grid,
  ].filter((grid): grid is TerrainGrid => Boolean(grid));

  const bounds = grids.reduce<XZBounds | null>(
    (current, grid) => expandBounds(current, getGridBounds(grid)),
    null,
  ) ?? getGridBounds(transition.toTerrain.grid);
  const layerRange = grids.reduce(
    (range, grid) => {
      const next = getGridLayerRange(grid);
      return {
        minY: Math.min(range.minY, next.minY),
        maxY: Math.max(range.maxY, next.maxY),
      };
    },
    getTerrainLayerRange(transition.toTerrain),
  );
  const originX = Math.floor(bounds.minX);
  const originZ = Math.floor(bounds.minZ);
  const maxX = Math.ceil(bounds.maxX);
  const maxZ = Math.ceil(bounds.maxZ);

  return {
    id: `${transition.fromTerrain.id}-${transition.toTerrain.id}-transition-shadow`,
    label: "Terrain transition shadow frame",
    grid: {
      originX,
      originZ,
      width: Math.max(1, maxX - originX + 1),
      depth: Math.max(1, maxZ - originZ + 1),
      layers:
        layerRange.minY === layerRange.maxY
          ? [{ y: layerRange.minY, masks: {} }]
          : [
              { y: layerRange.minY, masks: {} },
              { y: layerRange.maxY, masks: {} },
            ],
    },
    elements: [
      ...transition.fromTerrain.elements,
      ...transition.toTerrain.elements,
    ],
  };
}
