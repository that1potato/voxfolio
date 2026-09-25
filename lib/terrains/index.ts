/**
 * Terrain data layer — public surface.
 *
 * Split across sibling modules for maintainability; this barrel preserves the
 * single `@/lib/terrains` import path:
 *   - `types.ts`      — the terrain / block / element data model
 *   - `validation.ts` — runtime validators + id/href guards
 *   - `grid.ts`       — grid geometry, queries, and reframing helpers
 */
export * from "./types";
export * from "./validation";
export * from "./grid";
