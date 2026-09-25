"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BlockTypesDoc, MapData, Terrain, TerrainsDoc } from "./terrains";
import type { GeneratedSurroundings } from "./surroundings/types";
import type { RevealOrigin } from "./radial-reveal";

export interface TerrainNavigationOptions {
  origin?: RevealOrigin;
}

export interface TerrainNavigationRequest {
  key: number;
  fromTerrainId: string;
  targetTerrainId: string;
  origin: RevealOrigin;
}

interface TerrainContextValue {
  mapData: MapData;
  doc: TerrainsDoc;
  blockTypes: BlockTypesDoc;
  activeTerrainId: string;
  setActiveTerrainId: (id: string) => void;
  navigateTerrain: (id: string, options?: TerrainNavigationOptions) => boolean;
  navigationRequest: TerrainNavigationRequest | null;
  clearNavigationRequest: (key: number) => void;
  completeTerrainNavigation: (key: number) => void;
  activeTerrain: Terrain;
  activeSurroundings: GeneratedSurroundings | null;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
  previewMode: boolean;
}

const TerrainContext = createContext<TerrainContextValue | null>(null);

interface ProviderProps {
  mapData: MapData;
  /** Default terrain id when uncontrolled. */
  initialTerrainId?: string;
  /** Pass these to put the provider into controlled mode (e.g. editor store). */
  activeTerrainId?: string;
  onActiveTerrainIdChange?: (id: string) => boolean | void;
  onTerrainNavigationPreflight?: (id: string) => boolean | void;
  onTerrainNavigationCommit?: (id: string) => boolean | void;
  selectedElementId?: string | null;
  onSelectedElementIdChange?: (id: string | null) => void;
  /** When true, button clicks select the element instead of navigating. */
  previewMode?: boolean;
  children: ReactNode;
}

export function TerrainProvider({
  mapData,
  initialTerrainId,
  activeTerrainId: controlledTerrainId,
  onActiveTerrainIdChange,
  onTerrainNavigationPreflight,
  onTerrainNavigationCommit,
  selectedElementId: controlledSelectedId,
  onSelectedElementIdChange,
  previewMode = false,
  children,
}: ProviderProps) {
  const { terrains: doc, blockTypes } = mapData;
  const [localTerrainId, setLocalTerrainId] = useState(initialTerrainId ?? doc.rootTerrainId);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [navigationRequest, setNavigationRequest] =
    useState<TerrainNavigationRequest | null>(null);
  const navigationKey = useRef(0);

  const activeTerrainId = controlledTerrainId ?? localTerrainId;
  const setActiveTerrainId = useCallback((id: string) => {
    setNavigationRequest(null);
    if (onActiveTerrainIdChange) {
      onActiveTerrainIdChange(id);
      return;
    }
    setLocalTerrainId(id);
  }, [onActiveTerrainIdChange]);
  const selectedElementId = controlledSelectedId !== undefined ? controlledSelectedId : localSelectedId;
  const setSelectedElementId = onSelectedElementIdChange ?? setLocalSelectedId;
  const navigateTerrain = useCallback(
    (id: string, options?: TerrainNavigationOptions): boolean => {
      if (
        navigationRequest ||
        id === activeTerrainId ||
        !doc.terrains.some((terrain) => terrain.id === id)
      ) {
        return false;
      }

      if (!options?.origin) {
        setActiveTerrainId(id);
        return true;
      }

      const allowed = onTerrainNavigationPreflight
        ? onTerrainNavigationPreflight(id) !== false
        : true;
      if (!allowed) return false;

      setNavigationRequest({
        key: ++navigationKey.current,
        fromTerrainId: activeTerrainId,
        targetTerrainId: id,
        origin: options.origin,
      });
      return true;
    },
    [
      activeTerrainId,
      doc.terrains,
      navigationRequest,
      onTerrainNavigationPreflight,
      setActiveTerrainId,
    ],
  );
  const clearNavigationRequest = useCallback((key: number) => {
    setNavigationRequest((current) => (current?.key === key ? null : current));
  }, []);
  const completeTerrainNavigation = useCallback((key: number) => {
    if (!navigationRequest || navigationRequest.key !== key) return;
    const commit = onTerrainNavigationCommit ?? onActiveTerrainIdChange;
    if (commit) {
      commit(navigationRequest.targetTerrainId);
    } else {
      setLocalTerrainId(navigationRequest.targetTerrainId);
    }
    setNavigationRequest(null);
  }, [navigationRequest, onActiveTerrainIdChange, onTerrainNavigationCommit]);

  const value = useMemo<TerrainContextValue>(() => {
    const activeTerrain =
      doc.terrains.find((t) => t.id === activeTerrainId) ?? doc.terrains[0];
    const activeSurroundings = mapData.surroundings?.[activeTerrainId] ?? null;
    return {
      mapData,
      doc,
      blockTypes,
      activeTerrainId,
      setActiveTerrainId,
      navigateTerrain,
      navigationRequest,
      clearNavigationRequest,
      completeTerrainNavigation,
      activeTerrain,
      activeSurroundings,
      selectedElementId,
      setSelectedElementId,
      previewMode,
    };
  }, [
    mapData,
    doc,
    blockTypes,
    activeTerrainId,
    setActiveTerrainId,
    navigateTerrain,
    navigationRequest,
    clearNavigationRequest,
    completeTerrainNavigation,
    selectedElementId,
    setSelectedElementId,
    previewMode,
  ]);

  return <TerrainContext.Provider value={value}>{children}</TerrainContext.Provider>;
}

export function useTerrainContext(): TerrainContextValue {
  const v = useContext(TerrainContext);
  if (!v) throw new Error("useTerrainContext must be used within a TerrainProvider");
  return v;
}
