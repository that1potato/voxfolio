"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Object3D, type DirectionalLight } from "three";
import {
  getTerrainLayerRange,
  type Terrain as TerrainData,
} from "@/lib/terrains";
import type { SiteThemeMode } from "@/theme.config";
import { sceneLighting } from "./scene-lighting.config";
import { advanceBlend, lerpHexColors, THEME_BLEND } from "@/lib/theme-transition";

const KEY_LIGHT_OFFSET: [number, number, number] = [14, 25, 10];
const SHADOW_PADDING = 8;
const MIN_SHADOW_RADIUS = 25;
const MIN_SHADOW_DEPTH = 70;

interface ShadowFrame {
  center: [number, number, number];
  position: [number, number, number];
  radius: number;
  far: number;
}

interface MapKeyLightProps {
  terrain: TerrainData;
  /** Extra world-units added to the shadow camera radius (e.g. to cover surroundings). */
  extraRadius?: number;
  themeMode?: SiteThemeMode;
  /**
   * Scale applied by an ancestor group (the XR tabletop rig). The shadow
   * camera frustum and normal bias are expressed in world metres, so both
   * must shrink with the world: at 1/50 scale a desktop-sized frustum leaves
   * the island covering ~2% of the shadow map (shadows dissolve) and a
   * desktop-tuned bias becomes ~a full voxel of peter-panning.
   */
  worldScale?: number;
}

function getApproxElementRadius(
  terrain: TerrainData,
  center: ShadowFrame["center"],
) {
  return terrain.elements.reduce((maxRadius, element) => {
    const scale = element.scale ?? 1;
    const width =
      element.type === "button"
        ? element.width ?? 7
        : element.type === "image"
          ? element.width
          : element.type === "counter"
            ? Math.max(4, (element.digits ?? 6) * 3)
            : Math.max(4, element.text.length * 0.5);
    const depth =
      element.type === "button"
        ? element.depth ?? 1.8
        : element.type === "image"
          ? element.height
          : 2;
    const localRadius = (Math.max(width, depth, 2) * scale) / 2;
    const dx = element.position[0] - center[0];
    const dy = element.position[1] - center[1];
    const dz = element.position[2] - center[2];
    return Math.max(maxRadius, Math.hypot(dx, dy, dz) + localRadius);
  }, 0);
}

function getShadowFrame(terrain: TerrainData, extraRadius = 0): ShadowFrame {
  const grid = terrain.grid;
  const { minY, maxY } = getTerrainLayerRange(terrain);
  const center: ShadowFrame["center"] = [
    grid.originX + (grid.width - 1) / 2,
    (minY + maxY) / 2,
    grid.originZ + (grid.depth - 1) / 2,
  ];
  const terrainRadius = Math.hypot(
    grid.width / 2,
    Math.max(1, maxY - minY + 1) / 2,
    grid.depth / 2,
  );
  const radius = Math.ceil(
    Math.max(
      MIN_SHADOW_RADIUS,
      terrainRadius,
      getApproxElementRadius(terrain, center),
    ) + SHADOW_PADDING + extraRadius,
  );
  const lightDistance = Math.hypot(...KEY_LIGHT_OFFSET);
  const far = Math.ceil(Math.max(MIN_SHADOW_DEPTH, lightDistance + radius));

  return {
    center,
    position: [
      center[0] + KEY_LIGHT_OFFSET[0],
      center[1] + KEY_LIGHT_OFFSET[1],
      center[2] + KEY_LIGHT_OFFSET[2],
    ],
    radius,
    far,
  };
}

// Scratch Color for lerped writes.
const _color = new Color();

export function MapKeyLight({
  terrain,
  extraRadius = 0,
  themeMode = "light",
  worldScale = 1,
}: MapKeyLightProps) {
  const lightRef = useRef<DirectionalLight>(null);
  const invalidate = useThree((state) => state.invalidate);
  const shadowFrame = useMemo(() => getShadowFrame(terrain, extraRadius), [terrain, extraRadius]);
  // The light's aim point, mounted as a scene-graph sibling (same parent group)
  // so that when the XR tabletop rig scales/moves the world, the sun's direction
  // and shadow frustum follow it. An unparented target would stay in world space
  // (≈ the user's feet in an XR session) and fire the light at a degenerate angle.
  const target = useMemo(() => new Object3D(), []);

  // Blend scalar: 0 = light, 1 = dark.
  const blend = useRef({ value: THEME_BLEND[themeMode] });
  const prevMode = useRef<SiteThemeMode>(themeMode);

  useEffect(() => {
    if (prevMode.current !== themeMode) {
      prevMode.current = themeMode;
      invalidate();
    }
  }, [themeMode, invalidate]);

  useFrame((_, delta) => {
    const target = THEME_BLEND[themeMode];
    const settled = advanceBlend(blend.current, target, delta);
    const t = blend.current.value;

    const light = lightRef.current;
    if (light) {
      const L = sceneLighting.light.sun;
      const D = sceneLighting.dark.sun;
      lerpHexColors(L.color, D.color, t, _color);
      light.color.copy(_color);
      light.intensity = L.intensity + (D.intensity - L.intensity) * t;
    }

    if (!settled) invalidate();
  });

  const initSun = sceneLighting[themeMode].sun;

  useLayoutEffect(() => {
    const light = lightRef.current;
    if (!light) return;

    light.shadow.camera.updateProjectionMatrix();
    invalidate();
  }, [invalidate, shadowFrame, worldScale]);

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={shadowFrame.position}
        target={target}
        color={initSun.color}
        intensity={initSun.intensity}
        castShadow
        shadow-normalBias={0.02 * worldScale}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5 * worldScale}
        shadow-camera-far={shadowFrame.far * worldScale}
        shadow-camera-left={-shadowFrame.radius * worldScale}
        shadow-camera-right={shadowFrame.radius * worldScale}
        shadow-camera-top={shadowFrame.radius * worldScale}
        shadow-camera-bottom={-shadowFrame.radius * worldScale}
      />
      <primitive object={target} position={shadowFrame.center} />
    </>
  );
}
