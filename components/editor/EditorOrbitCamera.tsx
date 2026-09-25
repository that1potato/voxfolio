"use client";

import { useLayoutEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { MOUSE, MathUtils, PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  getDefaultMapCameraFrame,
  MAP_CAMERA_FOV,
} from "@/components/map/AmbientCamera";
import { useTerrainContext } from "@/lib/terrain-context";
import type { Terrain } from "@/lib/terrains";

interface Props {
  resetVersion: number;
  frameTerrain?: Terrain;
}

export function EditorOrbitCamera({ resetVersion, frameTerrain }: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { activeTerrain, activeTerrainId } = useTerrainContext();
  const terrain = frameTerrain ?? activeTerrain;
  const terrainFrameKey = frameTerrain?.id ?? activeTerrainId;
  const latestTerrain = useRef(activeTerrain);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const events = useThree((state) => state.events);
  const invalidate = useThree((state) => state.invalidate);
  latestTerrain.current = terrain;

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const frame = getDefaultMapCameraFrame(
      latestTerrain.current,
      size.width,
      size.height,
    );
    if (!controls || !frame) return;

    const perspectiveCamera = camera as PerspectiveCamera;
    camera.up.set(0, 1, 0);
    camera.position.copy(frame.position);
    controls.target.copy(frame.target);
    controls.minDistance = Math.max(2, frame.distance * 0.12);
    controls.maxDistance = frame.distance * 6;
    perspectiveCamera.fov = MAP_CAMERA_FOV;
    perspectiveCamera.clearViewOffset();
    perspectiveCamera.updateProjectionMatrix();
    controls.update();
    controls.saveState();
    invalidate();
    events.update?.();
  }, [
    camera,
    events,
    terrainFrameKey,
    invalidate,
    resetVersion,
    size.height,
    size.width,
  ]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={false}
      enablePan
      enableRotate
      enableZoom
      screenSpacePanning={false}
      minPolarAngle={MathUtils.degToRad(0.5)}
      maxPolarAngle={MathUtils.degToRad(179.5)}
      mouseButtons={{
        MIDDLE: MOUSE.PAN,
        RIGHT: MOUSE.ROTATE,
      }}
      onChange={() => {
        invalidate();
        events.update?.();
      }}
    />
  );
}
