/**
 * Single source of truth for voxel-text styling — like CSS root variables
 * but for the 3D scene.
 *
 * Edit values here to retune the look of ALL voxel text on the site at
 * once. Adding a new "kind" of text? Add a level here and create a
 * matching wrapper component in this folder.
 *
 * Conventions:
 *   - scale    = world units per font cube (5×7 grid, so a 5-letter word
 *                at scale 0.5 is ~14 world units wide)
 *   - depth    = number of cube layers stacked along +Z (thicker = chunkier)
 *   - color    = palette key from site.config.ts ("cream", "charcoal", "brown", …)
 */

export interface VoxelTextLevel {
  scale: number;
  depth: number;
  color: string;
}

export interface VoxelTextLevelFitted {
  /** Upper bound on auto-fit scale. */
  maxScale: number;
  depth: number;
  color: string;
}

export const levels = {
  /**
   * Site title — biggest and thickest. In ground orientation, `depth` is
   * the raised vertical height of each letter.
   */
  title: { scale: 0.7, depth: 1, color: "cream" } satisfies VoxelTextLevel,

  /** Button face labels — auto-fitted to the button width. */
  buttonLabel: { maxScale: 0.3, depth: 1, color: "cream" } satisfies VoxelTextLevelFitted,

  /** Small captions / hints / sub-labels in the scene. */
  caption: { scale: 0.18, depth: 1, color: "cream" } satisfies VoxelTextLevel,

  /** Nixie-tube counter digits — glowing, chunky. */
  counter: { scale: 0.45, depth: 1, color: "#ffae5e" } satisfies VoxelTextLevel,
};
