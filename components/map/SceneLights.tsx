"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  Object3D,
  type AmbientLight,
  type HemisphereLight,
  type DirectionalLight,
} from "three";
import type { SiteThemeMode } from "@/theme.config";
import { sceneLighting } from "./scene-lighting.config";
import { advanceBlend, lerpHexColors, THEME_BLEND } from "@/lib/theme-transition";

interface Props {
  themeMode: SiteThemeMode;
  /**
   * Multiplier on the ambient/hemisphere fill. Used by immersive XR sessions,
   * which lose the CSS VoxelBackdrop glow behind the canvas (AR shows the room,
   * VR draws its own sky) and read slightly dimmer than the flat site.
   */
  fillBoost?: number;
}

// Scratch Color for lerped writes.
const _color = new Color();

/**
 * Theme-aware ambient + hemisphere + rim lighting with smooth cross-fade.
 * Also adjusts gl.toneMappingExposure per mood (warm/bright day, dim/cool night).
 * MapKeyLight is kept as a sibling so its shadow-camera fitting logic stays self-contained.
 */
export function SceneLights({ themeMode, fillBoost = 1 }: Props) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const ambientRef = useRef<AmbientLight>(null);
  const hemiRef    = useRef<HemisphereLight>(null);
  const rimRef     = useRef<DirectionalLight>(null);
  // Aim point for the rim light, parented next to it so the rim direction
  // follows the XR tabletop rig instead of pointing at world origin (which sits
  // at the user's feet in an immersive session).
  const rimTarget = useMemo(() => new Object3D(), []);

  // Blend scalar: 0 = light, 1 = dark. Initialised to the current mode so there
  // is no fade on first mount — the scene appears fully in the active theme.
  const blend = useRef({ value: THEME_BLEND[themeMode] });
  // Track the previous themeMode so we can snap blend on the first frame after
  // a hard navigation (when the component remounts mid-theme).
  const prevMode = useRef<SiteThemeMode>(themeMode);

  // When themeMode changes, kick the render loop.
  useEffect(() => {
    if (prevMode.current !== themeMode) {
      prevMode.current = themeMode;
      invalidate();
    }
  }, [themeMode, invalidate]);

  // fillBoost flips on XR session enter/exit — repaint under frameloop="demand".
  useEffect(() => {
    invalidate();
  }, [fillBoost, invalidate]);

  useFrame((_, delta) => {
    const target = THEME_BLEND[themeMode];
    const settled = advanceBlend(blend.current, target, delta);

    const t = blend.current.value;
    const L = sceneLighting.light;
    const D = sceneLighting.dark;

    const ambient  = ambientRef.current;
    const hemi     = hemiRef.current;
    const rim      = rimRef.current;

    if (ambient) {
      lerpHexColors(L.ambient.color, D.ambient.color, t, _color);
      ambient.color.copy(_color);
      ambient.intensity =
        (L.ambient.intensity + (D.ambient.intensity - L.ambient.intensity) * t) *
        fillBoost;
    }

    if (hemi) {
      lerpHexColors(L.hemisphere.skyColor, D.hemisphere.skyColor, t, _color);
      hemi.color.copy(_color);
      lerpHexColors(L.hemisphere.groundColor, D.hemisphere.groundColor, t, _color);
      hemi.groundColor.copy(_color);
      hemi.intensity =
        (L.hemisphere.intensity +
          (D.hemisphere.intensity - L.hemisphere.intensity) * t) *
        fillBoost;
    }

    if (rim) {
      lerpHexColors(L.rim.color, D.rim.color, t, _color);
      rim.color.copy(_color);
      rim.intensity = L.rim.intensity + (D.rim.intensity - L.rim.intensity) * t;
    }

    gl.toneMappingExposure = L.exposure + (D.exposure - L.exposure) * t;

    if (!settled) invalidate();
  });

  // Use the current-mode config as the initial JSX attribute values (avoids a
  // one-frame flash at wrong colors before the first useFrame fires).
  const init = sceneLighting[themeMode];

  return (
    <>
      <ambientLight
        ref={ambientRef}
        color={init.ambient.color}
        intensity={init.ambient.intensity * fillBoost}
      />
      <hemisphereLight
        ref={hemiRef}
        color={init.hemisphere.skyColor}
        groundColor={init.hemisphere.groundColor}
        intensity={init.hemisphere.intensity * fillBoost}
      />
      <directionalLight
        ref={rimRef}
        position={init.rim.position}
        target={rimTarget}
        color={init.rim.color}
        intensity={init.rim.intensity}
      />
      <primitive object={rimTarget} />
    </>
  );
}
