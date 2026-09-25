import type { EditorState } from "../editor-store";
import type { BlockTypesDoc, Terrain, TerrainsDoc } from "../terrains";

/**
 * Pure terrain/doc transforms used by the editor store's mutations. No store
 * access — they take plain values and return new ones (the `EditorState` import
 * is type-only). Keeps the store body focused on wiring `set`/`get`.
 */

export const EMPTY_BLOCK_TYPES: BlockTypesDoc = {
  version: 2,
  defaultBlockTypeId: "",
  blockTypes: [],
};

export const EMPTY_DOC: TerrainsDoc = {
  version: 2,
  rootTerrainId: "",
  terrains: [],
};

export function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** Replace a single terrain in the doc via `transform`, clearing any save error. */
export function mapTerrain(
  state: EditorState,
  terrainId: string,
  transform: (terrain: Terrain) => Terrain,
): Pick<EditorState, "doc" | "saveError"> {
  return {
    doc: {
      ...state.doc,
      terrains: state.doc.terrains.map((terrain) =>
        terrain.id === terrainId ? transform(terrain) : terrain,
      ),
    },
    saveError: null,
  };
}

export function blockTypeIsUsed(doc: TerrainsDoc, blockTypeId: string): boolean {
  return doc.terrains.some((terrain) =>
    terrain.grid.layers.some((layer) =>
      Object.prototype.hasOwnProperty.call(layer.masks, blockTypeId),
    ),
  );
}
