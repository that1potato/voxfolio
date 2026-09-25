import type { EditorState, TerrainEditorStatus } from "../editor-store";
import type { Terrain } from "../terrains";

/**
 * Pure derivations over the editor store's state — dirty tracking and the
 * per-terrain status badge. Kept separate from the store so the mutation logic
 * stays focused. The `EditorState` import is type-only (erased at runtime), so
 * there is no runtime dependency cycle with `editor-store.ts`.
 */

function terrainChanged(current: Terrain | undefined, saved: Terrain | undefined): boolean {
  if (!current || !saved) return current !== saved;
  return JSON.stringify(current) !== JSON.stringify(saved);
}

export function isTerrainUnsaved(state: EditorState, terrainId: string): boolean {
  if (state.newTerrainIds.includes(terrainId)) return true;
  const current = state.doc.terrains.find((terrain) => terrain.id === terrainId);
  return terrainChanged(current, state.savedTerrains[terrainId]);
}

export function areBlockTypesUnsaved(state: EditorState): boolean {
  return JSON.stringify(state.blockTypes) !== JSON.stringify(state.savedBlockTypes);
}

export function hasUnsavedChanges(state: EditorState): boolean {
  return (
    areBlockTypesUnsaved(state) ||
    state.doc.terrains.some((terrain) => isTerrainUnsaved(state, terrain.id))
  );
}

export function getTerrainEditorStatus(
  state: EditorState,
  terrainId: string,
): TerrainEditorStatus {
  if (state.saving && terrainId === state.activeTerrainId) return "saving";
  if (state.saveError && terrainId === state.activeTerrainId) return "error";
  if (state.newTerrainIds.includes(terrainId)) return "new";
  return isTerrainUnsaved(state, terrainId) ? "dirty" : "clean";
}
