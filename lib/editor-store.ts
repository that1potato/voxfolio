"use client";

import { create } from "zustand";
import {
  cellsToLayer,
  fitTerrainToContent,
  growTerrainToInclude,
  reframeTerrainGrid,
  setTerrainBlock as updateTerrainBlock,
  type BlockTypeDefinition,
  type BlockTypesDoc,
  type MapData,
  type Terrain,
  type TerrainBlockPosition,
  type TerrainElement,
  type TerrainElementPatch,
  type TerrainsDoc,
} from "./terrains";
import type { GeneratedSurroundings } from "./surroundings/types";
import { areBlockTypesUnsaved, isTerrainUnsaved } from "./editor/selectors";
import {
  blockTypeIsUsed,
  EMPTY_BLOCK_TYPES,
  EMPTY_DOC,
  mapTerrain,
  withoutKey,
} from "./editor/terrain-ops";
import {
  deleteTerrainRequest,
  requestGeneratedSurroundings,
  saveMapData,
} from "./editor/api";

// Re-export the pure selectors so consumers keep importing from "@/lib/editor-store".
export {
  areBlockTypesUnsaved,
  getTerrainEditorStatus,
  hasUnsavedChanges,
  isTerrainUnsaved,
} from "./editor/selectors";

/** Empty cells around content bounds kept as a paintable buffer ring in the editor. */
export const EDGE_MARGIN = 3;

export type TerrainEditorStatus = "clean" | "dirty" | "new" | "saving" | "error";
export type EditorBuildMode = "add" | "delete";

/** A list-section item that a button can show as its hover card. */
export interface HoverItemRef {
  /** Hover-card key, `"<sectionId>/<itemSlug>"` (matches `ButtonElement.hoverCardItem`). */
  id: string;
  /** Picker label, e.g. `"PROJECTS › My Project"`. */
  label: string;
}

export interface EditorState {
  initialized: boolean;
  doc: TerrainsDoc;
  blockTypes: BlockTypesDoc;
  savedTerrains: Record<string, Terrain>;
  savedBlockTypes: BlockTypesDoc;
  newTerrainIds: string[];
  activeTerrainId: string;
  activeBlockTypeId: string;
  selectedElementId: string | null;
  testMode: boolean;
  buildEnabled: boolean;
  buildMode: EditorBuildMode;
  imageSurfacePickEnabled: boolean;
  cameraResetVersion: number;
  saving: boolean;
  saveError: string | null;
  generatedSurroundings: Record<string, GeneratedSurroundings>;
  pendingTerrainId: string | null;
  pendingCreatedTerrainId: string | null;
  /** List-section items available to link as button hover cards (set from the server). */
  availableHoverItems: HoverItemRef[];

  initialize: (mapData: MapData) => void;
  setAvailableHoverItems: (items: HoverItemRef[]) => void;
  requestTerrainSwitch: (id: string) => boolean;
  preflightTerrainSwitch: (id: string) => boolean;
  commitTerrainSwitch: (id: string) => boolean;
  cancelTerrainSwitch: () => void;
  discardAndSwitch: () => void;
  saveAndSwitch: () => Promise<boolean>;
  setSelectedElementId: (id: string | null) => void;
  setTestMode: (value: boolean) => void;
  setBuildEnabled: (value: boolean) => void;
  setImageSurfacePickEnabled: (value: boolean) => void;
  setActiveBlockTypeId: (id: string) => void;
  setBuildMode: (mode: EditorBuildMode) => void;
  resetCameraView: () => void;

  saveChanges: (terrainId: string) => Promise<boolean>;
  revertChanges: (terrainId: string) => void;
  importTerrain: (terrain: Terrain) => void;
  generateSurroundings: (terrainId: string) => Promise<boolean>;

  addBlockType: (blockType: BlockTypeDefinition) => void;
  updateBlockType: (id: string, patch: Partial<Omit<BlockTypeDefinition, "id">>) => void;
  setDefaultBlockType: (id: string) => void;
  deleteBlockType: (id: string) => boolean;

  resizeGrid: (terrainId: string, width: number, depth: number) => void;
  setGroundCells: (terrainId: string, cells: Array<string | null>) => void;
  setTerrainBlock: (
    terrainId: string,
    position: TerrainBlockPosition,
    blockTypeId: string | null,
  ) => void;
  addTerrain: (id: string, label: string) => void;
  deleteTerrain: (id: string) => Promise<boolean>;
  renameTerrain: (id: string, label: string) => void;
  /** Set (or clear, with `undefined`) a terrain's `atmosphere.config.ts` preset id. */
  setTerrainAtmosphere: (terrainId: string, atmosphere: string | undefined) => void;

  addElement: (terrainId: string, element: TerrainElement) => void;
  updateElement: (
    terrainId: string,
    elementId: string,
    patch: TerrainElementPatch,
  ) => void;
  deleteElement: (terrainId: string, elementId: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  initialized: false,
  doc: EMPTY_DOC,
  blockTypes: EMPTY_BLOCK_TYPES,
  savedTerrains: {},
  savedBlockTypes: EMPTY_BLOCK_TYPES,
  newTerrainIds: [],
  activeTerrainId: "",
  activeBlockTypeId: "",
  selectedElementId: null,
  testMode: false,
  buildEnabled: false,
  buildMode: "add",
  imageSurfacePickEnabled: false,
  cameraResetVersion: 0,
  saving: false,
  saveError: null,
  generatedSurroundings: {},
  pendingTerrainId: null,
  pendingCreatedTerrainId: null,
  availableHoverItems: [],

  setAvailableHoverItems: (items) => set({ availableHoverItems: items }),

  initialize: ({ terrains, blockTypes, surroundings }) =>
    set({
      initialized: true,
      doc: terrains,
      blockTypes,
      savedTerrains: Object.fromEntries(
        terrains.terrains.map((terrain) => [terrain.id, terrain]),
      ),
      savedBlockTypes: blockTypes,
      newTerrainIds: [],
      activeTerrainId: terrains.rootTerrainId,
      activeBlockTypeId: blockTypes.defaultBlockTypeId,
      selectedElementId: null,
      testMode: false,
      buildEnabled: false,
      buildMode: "add",
      imageSurfacePickEnabled: false,
      cameraResetVersion: 0,
      saving: false,
      saveError: null,
      generatedSurroundings: surroundings ?? {},
      pendingTerrainId: null,
      pendingCreatedTerrainId: null,
    }),

  requestTerrainSwitch: (id) => {
    const state = get();
    if (id === state.activeTerrainId || !state.doc.terrains.some((terrain) => terrain.id === id)) {
      return false;
    }
    if (isTerrainUnsaved(state, state.activeTerrainId)) {
      set({ pendingTerrainId: id, pendingCreatedTerrainId: null });
      return false;
    }
    set({
      activeTerrainId: id,
      selectedElementId: null,
      buildEnabled: false,
      imageSurfacePickEnabled: false,
      pendingTerrainId: null,
      pendingCreatedTerrainId: null,
      saveError: null,
    });
    return true;
  },

  preflightTerrainSwitch: (id) => {
    const state = get();
    if (id === state.activeTerrainId || !state.doc.terrains.some((terrain) => terrain.id === id)) {
      return false;
    }
    if (isTerrainUnsaved(state, state.activeTerrainId)) {
      set({ pendingTerrainId: id, pendingCreatedTerrainId: null });
      return false;
    }
    return true;
  },

  commitTerrainSwitch: (id) => {
    const state = get();
    if (id === state.activeTerrainId || !state.doc.terrains.some((terrain) => terrain.id === id)) {
      return false;
    }
    set({
      activeTerrainId: id,
      selectedElementId: null,
      buildEnabled: false,
      imageSurfacePickEnabled: false,
      pendingTerrainId: null,
      pendingCreatedTerrainId: null,
      saveError: null,
    });
    return true;
  },

  cancelTerrainSwitch: () =>
    set((state) => {
      const createdId = state.pendingCreatedTerrainId;
      return {
        doc: createdId
          ? {
              ...state.doc,
              terrains: state.doc.terrains.filter((terrain) => terrain.id !== createdId),
            }
          : state.doc,
        newTerrainIds: createdId
          ? state.newTerrainIds.filter((id) => id !== createdId)
          : state.newTerrainIds,
        pendingTerrainId: null,
        pendingCreatedTerrainId: null,
        saveError: null,
      };
    }),

  discardAndSwitch: () =>
    set((state) => {
      const targetId = state.pendingTerrainId;
      if (!targetId) return state;
      const currentId = state.activeTerrainId;
      const currentIsNew = state.newTerrainIds.includes(currentId);
      const saved = state.savedTerrains[currentId];
      const terrains = currentIsNew
        ? state.doc.terrains.filter((terrain) => terrain.id !== currentId)
        : state.doc.terrains.map((terrain) =>
            terrain.id === currentId && saved ? saved : terrain,
          );
      return {
        doc: { ...state.doc, terrains },
        newTerrainIds: currentIsNew
          ? state.newTerrainIds.filter((id) => id !== currentId)
          : state.newTerrainIds,
        activeTerrainId: targetId,
        selectedElementId: null,
        buildEnabled: false,
        imageSurfacePickEnabled: false,
        pendingTerrainId: null,
        pendingCreatedTerrainId: null,
        saveError: null,
      };
    }),

  saveAndSwitch: async () => {
    const state = get();
    const targetId = state.pendingTerrainId;
    if (!targetId) return false;
    const saved = await state.saveChanges(state.activeTerrainId);
    if (!saved) return false;
    set({
      activeTerrainId: targetId,
      selectedElementId: null,
      buildEnabled: false,
      imageSurfacePickEnabled: false,
      pendingTerrainId: null,
      pendingCreatedTerrainId: null,
    });
    return true;
  },

  setSelectedElementId: (id) =>
    set({
      selectedElementId: id,
      imageSurfacePickEnabled: false,
    }),
  setTestMode: (value) =>
    set({
      testMode: value,
      ...(value ? { buildEnabled: false, imageSurfacePickEnabled: false } : {}),
    }),
  setBuildEnabled: (value) =>
    set({
      buildEnabled: value,
      ...(value
        ? {
            testMode: false,
            selectedElementId: null,
            imageSurfacePickEnabled: false,
          }
        : {}),
    }),
  setImageSurfacePickEnabled: (value) =>
    set({
      imageSurfacePickEnabled: value,
      ...(value ? { buildEnabled: false, testMode: false } : {}),
    }),
  setBuildMode: (mode) => set({ buildMode: mode }),
  resetCameraView: () =>
    set((state) => ({ cameraResetVersion: state.cameraResetVersion + 1 })),
  setActiveBlockTypeId: (id) => {
    if (get().blockTypes.blockTypes.some((blockType) => blockType.id === id)) {
      set({ activeBlockTypeId: id });
    }
  },

  saveChanges: async (terrainId) => {
    const state = get();
    const terrain = state.doc.terrains.find((item) => item.id === terrainId);
    const terrainDirty = isTerrainUnsaved(state, terrainId);
    const blockTypesDirty = areBlockTypesUnsaved(state);
    if ((!terrainDirty && !blockTypesDirty) || state.saving) return !state.saving;

    const blockTypes = state.blockTypes;
    set({ saving: true, saveError: null });

    try {
      await saveMapData({
        blockTypes: blockTypesDirty ? blockTypes : undefined,
        terrain: terrainDirty ? terrain : undefined,
      });

      set((current) => ({
        savedBlockTypes: blockTypesDirty ? blockTypes : current.savedBlockTypes,
        savedTerrains:
          terrainDirty && terrain
            ? { ...current.savedTerrains, [terrainId]: terrain }
            : current.savedTerrains,
        newTerrainIds: terrainDirty
          ? current.newTerrainIds.filter((id) => id !== terrainId)
          : current.newTerrainIds,
        saving: false,
        saveError: null,
      }));
      return true;
    } catch (error) {
      set({
        saving: false,
        saveError: error instanceof Error ? error.message : "failed to save map data",
      });
      return false;
    }
  },

  generateSurroundings: async (terrainId) => {
    const state = get();
    if (state.saving) return false;
    const terrain = state.doc.terrains.find((item) => item.id === terrainId);
    if (!terrain) return false;
    set({ saving: true, saveError: null });
    try {
      const surroundings = await requestGeneratedSurroundings(terrainId, {
        terrain,
        blockTypes: state.blockTypes,
        seed: Math.floor(Math.random() * 2 ** 31),
      });
      if (surroundings) {
        set((current) => ({
          saving: false,
          saveError: null,
          generatedSurroundings: { ...current.generatedSurroundings, [terrainId]: surroundings },
        }));
      } else {
        set({ saving: false, saveError: null });
      }
      return true;
    } catch (error) {
      set({
        saving: false,
        saveError: error instanceof Error ? error.message : "failed to generate surroundings",
      });
      return false;
    }
  },

  revertChanges: (terrainId) =>
    set((state) => {
      const isNew = state.newTerrainIds.includes(terrainId);
      const saved = state.savedTerrains[terrainId];
      const terrains = isNew
        ? state.doc.terrains.filter((terrain) => terrain.id !== terrainId)
        : state.doc.terrains.map((terrain) =>
            terrain.id === terrainId && saved ? saved : terrain,
          );
      const activeBlockTypeId = state.savedBlockTypes.blockTypes.some(
        (blockType) => blockType.id === state.activeBlockTypeId,
      )
        ? state.activeBlockTypeId
        : state.savedBlockTypes.defaultBlockTypeId;
      return {
        doc: { ...state.doc, terrains },
        blockTypes: state.savedBlockTypes,
        newTerrainIds: isNew
          ? state.newTerrainIds.filter((id) => id !== terrainId)
          : state.newTerrainIds,
        activeTerrainId: isNew ? state.doc.rootTerrainId : state.activeTerrainId,
        activeBlockTypeId,
        selectedElementId: null,
        buildEnabled: isNew ? false : state.buildEnabled,
        saveError: null,
      };
    }),

  importTerrain: (terrain) =>
    set((state) => ({
      doc: {
        ...state.doc,
        terrains: state.doc.terrains.map((current) =>
          current.id === terrain.id ? terrain : current,
        ),
      },
      selectedElementId: null,
      saveError: null,
    })),

  addBlockType: (blockType) =>
    set((state) => {
      if (state.blockTypes.blockTypes.some((current) => current.id === blockType.id)) {
        return state;
      }
      return {
        blockTypes: {
          ...state.blockTypes,
          blockTypes: [...state.blockTypes.blockTypes, blockType],
        },
        activeBlockTypeId: blockType.id,
        saveError: null,
      };
    }),

  updateBlockType: (id, patch) =>
    set((state) => ({
      blockTypes: {
        ...state.blockTypes,
        blockTypes: state.blockTypes.blockTypes.map((blockType) =>
          blockType.id === id ? { ...blockType, ...patch } : blockType,
        ),
      },
      saveError: null,
    })),

  setDefaultBlockType: (id) =>
    set((state) =>
      state.blockTypes.blockTypes.some((blockType) => blockType.id === id)
        ? {
            blockTypes: { ...state.blockTypes, defaultBlockTypeId: id },
            saveError: null,
          }
        : state,
    ),

  deleteBlockType: (id) => {
    const state = get();
    if (
      state.blockTypes.blockTypes.length <= 1 ||
      state.blockTypes.defaultBlockTypeId === id ||
      blockTypeIsUsed(state.doc, id)
    ) {
      return false;
    }
    set({
      blockTypes: {
        ...state.blockTypes,
        blockTypes: state.blockTypes.blockTypes.filter((blockType) => blockType.id !== id),
      },
      activeBlockTypeId:
        state.activeBlockTypeId === id
          ? state.blockTypes.defaultBlockTypeId
          : state.activeBlockTypeId,
      saveError: null,
    });
    return true;
  },

  resizeGrid: (terrainId, width, depth) =>
    set((state) =>
      mapTerrain(state, terrainId, (terrain) => {
        const { originX, originZ } = terrain.grid;
        return reframeTerrainGrid(terrain, {
          minX: originX,
          maxX: originX + width - 1,
          minZ: originZ,
          maxZ: originZ + depth - 1,
        });
      }),
    ),

  setGroundCells: (terrainId, cells) =>
    set((state) =>
      mapTerrain(state, terrainId, (terrain) => {
        const groundLayer = cellsToLayer(
          cells,
          terrain.grid.width,
          terrain.grid.depth,
          0,
        );
        const otherLayers = terrain.grid.layers.filter((layer) => layer.y !== 0);
        const updated: Terrain = {
          ...terrain,
          grid: {
            ...terrain.grid,
            layers: groundLayer
              ? [...otherLayers, groundLayer].sort((a, b) => a.y - b.y)
              : otherLayers,
          },
        };
        return fitTerrainToContent(updated, EDGE_MARGIN);
      }),
    ),

  setTerrainBlock: (terrainId, position, blockTypeId) =>
    set((state) => {
      if (position[1] < 0) return state;
      if (
        blockTypeId !== null &&
        !state.blockTypes.blockTypes.some((blockType) => blockType.id === blockTypeId)
      ) {
        return state;
      }
      const terrain = state.doc.terrains.find((item) => item.id === terrainId);
      if (!terrain) return state;
      return mapTerrain(state, terrainId, (current) => {
        const grown = blockTypeId !== null
          ? growTerrainToInclude(current, position[0], position[2])
          : current;
        const placed = updateTerrainBlock(grown, position, blockTypeId);
        // After deletion, re-fit to keep the margin ring tight
        return blockTypeId === null ? fitTerrainToContent(placed, EDGE_MARGIN) : placed;
      });
    }),

  addTerrain: (id, label) =>
    set((state) => {
      if (state.doc.terrains.some((terrain) => terrain.id === id)) return state;
      const width = 21;
      const depth = 15;
      const defaultBlockTypeId = state.blockTypes.defaultBlockTypeId;
      const groundLayer = cellsToLayer(
        Array<string>(width * depth).fill(defaultBlockTypeId),
        width,
        depth,
      );
      const terrain: Terrain = {
        id,
        label,
        grid: {
          width,
          depth,
          originX: -10,
          originZ: -7,
          layers: groundLayer ? [groundLayer] : [],
        },
        elements: [],
      };
      const nextDoc = { ...state.doc, terrains: [...state.doc.terrains, terrain] };
      if (isTerrainUnsaved(state, state.activeTerrainId)) {
        return {
          doc: nextDoc,
          newTerrainIds: [...state.newTerrainIds, id],
          pendingTerrainId: id,
          pendingCreatedTerrainId: id,
        };
      }
      return {
        doc: nextDoc,
        newTerrainIds: [...state.newTerrainIds, id],
        activeTerrainId: id,
        selectedElementId: null,
        buildEnabled: false,
      };
    }),

  deleteTerrain: async (id) => {
    const state = get();
    if (id === state.doc.rootTerrainId) return false;

    if (state.newTerrainIds.includes(id)) {
      set({
        doc: {
          ...state.doc,
          terrains: state.doc.terrains.filter((terrain) => terrain.id !== id),
        },
        newTerrainIds: state.newTerrainIds.filter((terrainId) => terrainId !== id),
        generatedSurroundings: withoutKey(state.generatedSurroundings, id),
        activeTerrainId: state.doc.rootTerrainId,
        selectedElementId: null,
        buildEnabled: false,
        saveError: null,
      });
      return true;
    }

    if (state.saving) return false;
    set({ saving: true, saveError: null });

    try {
      await deleteTerrainRequest(id);

      set((current) => ({
        doc: {
          ...current.doc,
          terrains: current.doc.terrains.filter((terrain) => terrain.id !== id),
        },
        savedTerrains: withoutKey(current.savedTerrains, id),
        // The server removed its generated-surroundings file too; drop the
        // preview copy so a reused id can't resurrect stale surroundings.
        generatedSurroundings: withoutKey(current.generatedSurroundings, id),
        activeTerrainId: current.doc.rootTerrainId,
        selectedElementId: null,
        buildEnabled: false,
        saving: false,
        saveError: null,
      }));
      return true;
    } catch (error) {
      set({
        saving: false,
        saveError: error instanceof Error ? error.message : "failed to delete terrain",
      });
      return false;
    }
  },

  renameTerrain: (id, label) =>
    set((state) =>
      mapTerrain(state, id, (terrain) => ({ ...terrain, label })),
    ),

  setTerrainAtmosphere: (terrainId, atmosphere) =>
    set((state) =>
      mapTerrain(state, terrainId, (terrain) => {
        // Drop the key for the default look so the saved JSON (and the
        // serialized dirty check) matches a terrain that never had one.
        const next = { ...terrain };
        delete next.atmosphere;
        if (!atmosphere) return next;
        const { id, label, ...rest } = next;
        return { id, label, atmosphere, ...rest };
      }),
    ),

  addElement: (terrainId, element) =>
    set((state) =>
      mapTerrain(state, terrainId, (terrain) => ({
        ...terrain,
        elements: [...terrain.elements, element],
      })),
    ),

  updateElement: (terrainId, elementId, patch) =>
    set((state) =>
      mapTerrain(state, terrainId, (terrain) => ({
        ...terrain,
        elements: terrain.elements.map((element) =>
          element.id === elementId
            ? ({ ...element, ...patch } as TerrainElement)
            : element,
        ),
      })),
    ),

  deleteElement: (terrainId, elementId) =>
    set((state) => ({
      ...mapTerrain(state, terrainId, (terrain) => ({
        ...terrain,
        elements: terrain.elements.filter((element) => element.id !== elementId),
      })),
      selectedElementId:
        state.selectedElementId === elementId ? null : state.selectedElementId,
    })),
}));
