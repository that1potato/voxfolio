import type { CSSProperties } from "react";
import type { SiteThemeMode } from "@/theme.config";
import { getVoxelBackdropStyle } from "./voxel-backdrop.config";

interface Props {
  themeMode: SiteThemeMode;
  /** Terrain atmosphere preset id (`atmosphere.config.ts`); overrides the mode's sky. */
  atmosphere?: string;
  opacity?: number;
  opacityTransitionMs?: number;
  showReadingSky?: boolean;
}

export function VoxelBackdrop({
  themeMode,
  atmosphere,
  opacity = 1,
  opacityTransitionMs = 0,
  showReadingSky = false,
}: Props) {
  const style = {
    ...getVoxelBackdropStyle(themeMode, atmosphere),
    "--voxel-backdrop-opacity-duration": `${opacityTransitionMs}ms`,
    opacity,
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className="voxel-backdrop"
      data-theme={themeMode}
      style={style}
    >
      {showReadingSky && <VoxelSkyDecor themeMode={themeMode} />}
    </div>
  );
}

function VoxelSkyDecor({ themeMode }: { themeMode: SiteThemeMode }) {
  if (themeMode === "dark") {
    return (
      <div className="voxel-sky-decor voxel-sky-decor--dark">
        <div className="voxel-moon" />
        <span className="voxel-star voxel-star--one" />
        <span className="voxel-star voxel-star--two" />
        <span className="voxel-star voxel-star--three" />
        <span className="voxel-star voxel-star--four" />
        <span className="voxel-star voxel-star--five" />
        <span className="voxel-star voxel-star--six" />
        <span className="voxel-star voxel-star--seven" />
        <span className="voxel-star voxel-star--eight" />
        <span className="voxel-star voxel-star--nine" />
        <span className="voxel-star voxel-star--ten" />
        <span className="voxel-star voxel-star--eleven" />
        <span className="voxel-star voxel-star--twelve" />
        <span className="voxel-star voxel-star--thirteen" />
        <span className="voxel-star voxel-star--fourteen" />
      </div>
    );
  }

  return (
    <div className="voxel-sky-decor voxel-sky-decor--light">
      <span className="voxel-cloud voxel-cloud--one" />
      <span className="voxel-cloud voxel-cloud--two" />
      <span className="voxel-cloud voxel-cloud--four" />
      <span className="voxel-cloud voxel-cloud--five" />
    </div>
  );
}
