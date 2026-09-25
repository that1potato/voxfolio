"use client";

import { useMemo } from "react";
import { getTerrainBlocks } from "@/lib/terrains";
import { resolveThemeColor } from "@/lib/theme-colors";
import type { SiteThemeMode } from "@/theme.config";
import type { GeneratedSurroundings } from "@/lib/surroundings/types";
import { InstancedVoxels } from "./InstancedVoxels";
import type { RadialRevealMask } from "@/lib/radial-reveal";

interface Props {
  surroundings: GeneratedSurroundings;
  themeMode: SiteThemeMode;
  radialReveal?: RadialRevealMask;
}

/** Renders the decorative, non-interactive voxel border around the active terrain. */
export function SurroundingsLayer({ surroundings, themeMode, radialReveal }: Props) {
  const instances = useMemo(() => {
    const pseudoTerrain = { id: "", label: "", grid: surroundings.grid, elements: [] };
    return getTerrainBlocks(pseudoTerrain).map((block) => {
      const pair = surroundings.palette[block.blockTypeId];
      return {
        position: block.position,
        color: pair ? resolveThemeColor(pair, themeMode) : "#888888",
      };
    });
  }, [surroundings, themeMode]);

  return <InstancedVoxels instances={instances} radialReveal={radialReveal} />;
}
