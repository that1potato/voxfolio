import type { TerrainGrid } from "@/lib/terrains";
import type { ThemeColorPair } from "@/lib/theme-colors";

export interface GeneratedSurroundingsSource {
  originX: number;
  originZ: number;
  width: number;
  depth: number;
}

export interface GeneratedSurroundings {
  version: 2;
  sourceTerrainId: string;
  source: GeneratedSurroundingsSource;
  seed: number;
  /** Self-contained color palette — mask keys reference these, not block-types.json. */
  palette: Record<string, ThemeColorPair>;
  grid: TerrainGrid;
}

export function isSurroundingsStale(
  surroundings: GeneratedSurroundings,
  grid: { originX: number; originZ: number; width: number; depth: number },
): boolean {
  const s = surroundings.source;
  return (
    s.originX !== grid.originX ||
    s.originZ !== grid.originZ ||
    s.width !== grid.width ||
    s.depth !== grid.depth
  );
}
