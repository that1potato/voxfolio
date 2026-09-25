"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { useTerrainContext } from "@/lib/terrain-context";
import type { Terrain } from "@/lib/terrains";
import { getTerrainLayerRange } from "@/lib/terrains";
import { getElementBounds } from "./element-bounds";
import type { RadialRevealState } from "@/lib/radial-reveal";

export type MapPresentationMode = "map" | "reading";

interface Props {
  mode?: MapPresentationMode;
  frameTerrain?: Terrain;
  cameraTransition?: TerrainCameraTransition;
  readingPanelBottomPx?: number | null;
}

export interface TerrainCameraTransition {
  fromTerrain: Terrain;
  toTerrain: Terrain;
  state: MutableRefObject<RadialRevealState>;
}

export const MAP_CAMERA_FOV = 5;
const READING_CAMERA_FOV = 5;

// Camera sits SOUTH of the map with a 7° lean WEST (three.js: -X=west, +Z=south).
// The 5° map FOV pushes the fitted camera far back, producing the near-parallel
// rectangle edges in the visual reference without switching camera types.
//   x = -35 * sin(7°) ≈ -4.3,  z = 35 * cos(7°) ≈ 34.7,  y = 40.5 (≈49° pitch)
const BASE_OFFSET = new Vector3(-4.3, 40.5, 34.7);
const MAP_LOOK_Y_OFFSET = 1;

// Reading mode orbits to a raised elevation so the island reads with depth
// (its top surface visible) rather than as a near-horizon flat strip — giving
// the mosaic lens more terrain to pixelate behind the lower panel edge.
const READING_OFFSET = new Vector3(0, 18, 160);
const READING_LOOK_Y_OFFSET = 18;
const READING_VIEW_SHIFT = -0.0;
const READING_ANCHOR_GAP_PX = 24;

// Set to 0 for a stable framing. Bump to ~1 for ambient drift.
const MOTION = 0;

// Inset the bbox corners by these world-unit amounts before fit calculation.
// e.g. a 41x29 grid (halfW=20, halfD=14) is fitted as ±17/±13, while the map
// padding keeps the compressed-lens framing inside the viewport.
const CORNER_INSET_X = 3;
const CORNER_INSET_Z = 1;
const PADDING = 1.2;

// Map-mode autofit pretends every terrain is this tall (base at y=0), so the
// framing stays stable no matter how high the real voxels stack.
const FIT_HEIGHT = 3;
const CAMERA_DAMPING = 5;

function fitScale({
  fov,
  aspect,
  terrainCenter,
  offset,
  lookYOffset,
  points,
  padding,
}: {
  fov: number;
  aspect: number;
  terrainCenter: Vector3;
  offset: Vector3;
  lookYOffset: number;
  points: Vector3[];
  padding: number;
}) {
  const fitTarget = 1 / padding;
  let lo = 0.35;
  let hi = 64;

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const probe = new PerspectiveCamera(fov, aspect, 1, 10000);
    probe.position.copy(offset).multiplyScalar(mid).add(terrainCenter);
    probe.lookAt(
      terrainCenter.x,
      terrainCenter.y + lookYOffset,
      terrainCenter.z,
    );
    probe.updateProjectionMatrix();
    probe.updateMatrixWorld();

    let maxNdc = 0;
    for (const point of points) {
      const ndc = point.clone().project(probe);
      maxNdc = Math.max(maxNdc, Math.abs(ndc.x), Math.abs(ndc.y));
    }

    if (maxNdc > fitTarget) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}

function getTerrainCenter(terrain: Terrain): Vector3 {
  const grid = terrain.grid;
  return new Vector3(
    grid.originX + (grid.width - 1) / 2,
    FIT_HEIGHT / 2,
    grid.originZ + (grid.depth - 1) / 2,
  );
}

function getMapCorners(terrain: Terrain, center: Vector3): Vector3[] {
  const grid = terrain.grid;
  const halfW = (grid.width - 1) / 2;
  const halfD = (grid.depth - 1) / 2;
  const cx = Math.max(1, halfW - CORNER_INSET_X);
  const cz = Math.max(1, halfD - CORNER_INSET_Z);
  const points: Vector3[] = [];

  for (const x of [center.x - cx, center.x + cx]) {
    for (const y of [0, FIT_HEIGHT]) {
      for (const z of [center.z - cz, center.z + cz]) {
        points.push(new Vector3(x, y, z));
      }
    }
  }
  terrain.elements.forEach((element) => {
    points.push(...getElementBounds(element));
  });
  return points;
}

export interface MapCameraFrame {
  position: Vector3;
  target: Vector3;
  distance: number;
}

export function getDefaultMapCameraFrame(
  terrain: Terrain,
  width: number,
  height: number,
): MapCameraFrame | null {
  const aspect = width / height;
  if (!Number.isFinite(aspect) || aspect <= 0) return null;

  const center = getTerrainCenter(terrain);
  const scale = fitScale({
    fov: MAP_CAMERA_FOV,
    aspect,
    terrainCenter: center,
    offset: BASE_OFFSET,
    lookYOffset: MAP_LOOK_Y_OFFSET,
    points: getMapCorners(terrain, center),
    padding: PADDING,
  });
  const target = new Vector3(
    center.x,
    center.y + MAP_LOOK_Y_OFFSET,
    center.z,
  );
  const position = BASE_OFFSET.clone().multiplyScalar(scale).add(center);
  return {
    position,
    target,
    distance: position.distanceTo(target),
  };
}

export function AmbientCamera({
  mode = "map",
  frameTerrain,
  cameraTransition,
  readingPanelBottomPx,
}: Props) {
  const { camera, size } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const { activeTerrain } = useTerrainContext();
  const terrain = frameTerrain ?? activeTerrain;
  const lookAtPoint = useRef(new Vector3());
  const desiredPosition = useRef(new Vector3());
  const desiredLookAt = useRef(new Vector3());
  const viewShift = useRef(0);
  const mapScale = useRef(1);
  const readingScale = useRef(1);
  const projectedAnchor = useRef(new Vector3());
  const transitionPosition = useRef(new Vector3());
  const transitionLookAt = useRef(new Vector3());
  // First map-mode frame snaps straight to the fitted framing instead of flying
  // in from the Canvas's default camera pose.
  const introSnapRef = useRef(true);

  const terrainCenter = useMemo(
    () => getTerrainCenter(terrain),
    [terrain],
  );

  const mapCorners = useMemo(
    () => getMapCorners(terrain, terrainCenter),
    [terrain, terrainCenter],
  );

  const readingBounds = useMemo(() => {
    const g = terrain.grid;
    const minX = g.originX - 0.5;
    const maxX = g.originX + g.width - 0.5;
    const minZ = g.originZ - 0.5;
    const maxZ = g.originZ + g.depth - 0.5;
    const layerRange = getTerrainLayerRange(terrain);
    const maxElementY = terrain.elements.reduce(
      (maxY, element) => Math.max(maxY, element.position[1] + 2),
      Math.max(3, layerRange.maxY + 0.5),
    );
    const points: Vector3[] = [];

    for (const x of [minX, maxX]) {
      for (const y of [Math.min(-2.5, layerRange.minY - 0.5), maxElementY]) {
        for (const z of [minZ, maxZ]) {
          points.push(new Vector3(x, y, z));
        }
      }
    }
    terrain.elements.forEach((element) => {
      points.push(...getElementBounds(element));
    });

    return points;
  }, [terrain]);

  // Recompute both presentations whenever the canvas or terrain changes.
  useEffect(() => {
    const aspect = size.width / size.height;
    if (!Number.isFinite(aspect) || aspect <= 0) return;

    mapScale.current = fitScale({
      fov: MAP_CAMERA_FOV,
      aspect,
      terrainCenter,
      offset: BASE_OFFSET,
      lookYOffset: MAP_LOOK_Y_OFFSET,
      points: mapCorners,
      padding: PADDING,
    });
    readingScale.current = fitScale({
      fov: READING_CAMERA_FOV,
      aspect,
      terrainCenter,
      offset: READING_OFFSET,
      lookYOffset: READING_LOOK_Y_OFFSET,
      points: readingBounds,
      padding: 1.12,
    });
    invalidate(); // re-fit happened (resize / terrain swap) — drive the lerp
  }, [size, mapCorners, readingBounds, terrainCenter, invalidate]);

  const transitionFrames = useMemo(() => {
    if (!cameraTransition) return null;
    const fromFrame = getDefaultMapCameraFrame(
      cameraTransition.fromTerrain,
      size.width,
      size.height,
    );
    const toFrame = getDefaultMapCameraFrame(
      cameraTransition.toTerrain,
      size.width,
      size.height,
    );
    if (!fromFrame || !toFrame) return null;
    return { fromFrame, toFrame };
  }, [cameraTransition, size.height, size.width]);

  // Presentation toggle (map <-> reading) changes the camera target; kick a
  // frame so the lerp loop below starts running again under frameloop="demand".
  useEffect(() => invalidate(), [mode, readingPanelBottomPx, invalidate]);

  useFrame((state, delta) => {
    // In an immersive XR session the headset owns the camera pose; never fight
    // it by writing camera.position. The desktop framing resumes automatically
    // when presenting ends (XRLayer kicks a frame so this loop re-settles).
    if (gl.xr.isPresenting) return;
    const reading = mode === "reading";
    const t = state.clock.elapsedTime * 0.08;
    const sway = reading ? 0 : Math.sin(t) * 1.2 * MOTION;
    const drift = reading ? 0 : Math.cos(t) * 0.6 * MOTION;
    const offset = reading ? READING_OFFSET : BASE_OFFSET;
    const scale = reading ? readingScale.current : mapScale.current;
    const lookYOffset = reading
      ? READING_LOOK_Y_OFFSET
      : MAP_LOOK_Y_OFFSET;
    const targetFov = reading ? READING_CAMERA_FOV : MAP_CAMERA_FOV;
    const alpha = 1 - Math.exp(-CAMERA_DAMPING * delta);
    const pCam = camera as PerspectiveCamera;

    const transitionDriving = !reading && transitionFrames;

    if (transitionDriving) {
      const progress = cameraTransition?.state.current.progress ?? 0;
      desiredPosition.current.lerpVectors(
        transitionFrames.fromFrame.position,
        transitionFrames.toFrame.position,
        progress,
      );
      desiredLookAt.current.lerpVectors(
        transitionFrames.fromFrame.target,
        transitionFrames.toFrame.target,
        progress,
      );
    } else {
      transitionPosition.current
        .set(
          offset.x * scale + sway,
          offset.y * scale,
          offset.z * scale + drift,
        )
        .add(terrainCenter);
      transitionLookAt.current.set(
        terrainCenter.x,
        terrainCenter.y + lookYOffset,
        terrainCenter.z,
      );
      desiredPosition.current.copy(transitionPosition.current);
      desiredLookAt.current.copy(transitionLookAt.current);
    }

    if (transitionDriving) {
      camera.position.copy(desiredPosition.current);
      lookAtPoint.current.copy(desiredLookAt.current);
      pCam.fov = targetFov;
    } else if (introSnapRef.current && !reading) {
      // On first load, place the camera at its fitted framing immediately
      // (computed synchronously so it doesn't depend on the fit effect having
      // run yet) rather than lerping in from the default pose. The island
      // materialises via the radial reveal while the camera holds still.
      const frame = getDefaultMapCameraFrame(terrain, size.width, size.height);
      if (frame) {
        desiredPosition.current.copy(frame.position);
        desiredLookAt.current.copy(frame.target);
        camera.position.copy(frame.position);
        lookAtPoint.current.copy(frame.target);
        pCam.fov = targetFov;
        introSnapRef.current = false;
      } else {
        // Viewport not measured yet — wait a frame rather than fly from default.
        camera.lookAt(lookAtPoint.current);
        invalidate();
        return;
      }
    } else {
      camera.position.lerp(desiredPosition.current, alpha);
      lookAtPoint.current.lerp(desiredLookAt.current, alpha);
      pCam.fov += (targetFov - pCam.fov) * alpha;
    }
    camera.lookAt(lookAtPoint.current);
    pCam.clearViewOffset();
    pCam.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Keep the full-screen canvas in place and shift only the reading
    // projection so the terrain anchor tracks the actual panel bottom.
    let targetViewShift = reading ? size.height * READING_VIEW_SHIFT : 0;
    if (
      reading &&
      readingPanelBottomPx !== null &&
      readingPanelBottomPx !== undefined &&
      Number.isFinite(readingPanelBottomPx) &&
      size.height > 0
    ) {
      const anchorNdc = projectedAnchor.current
        .copy(terrainCenter)
        .project(pCam);
      const anchorScreenY = ((1 - anchorNdc.y) / 2) * size.height;
      const targetAnchorY = readingPanelBottomPx - READING_ANCHOR_GAP_PX;
      if (Number.isFinite(anchorScreenY) && Number.isFinite(targetAnchorY)) {
        targetViewShift = anchorScreenY - targetAnchorY;
      }
    }
    viewShift.current += (targetViewShift - viewShift.current) * alpha;
    if (!reading && Math.abs(viewShift.current) < 0.1) {
      viewShift.current = 0;
      pCam.clearViewOffset();
    } else {
      pCam.setViewOffset(
        size.width,
        size.height,
        0,
        viewShift.current,
        size.width,
        size.height,
      );
    }
    pCam.updateProjectionMatrix();

    // frameloop="demand": keep requesting frames only until the camera settles,
    // then stop rendering entirely. Anything that later moves the scene must
    // call invalidate() (the fit/mode effects above, and InstancedVoxels do).
    const settled =
      camera.position.distanceToSquared(desiredPosition.current) < 1e-5 &&
      lookAtPoint.current.distanceToSquared(desiredLookAt.current) < 1e-5 &&
      Math.abs(targetFov - pCam.fov) < 1e-3 &&
      Math.abs(targetViewShift - viewShift.current) < 0.1;
    if (!settled) invalidate();
  });

  return null;
}
