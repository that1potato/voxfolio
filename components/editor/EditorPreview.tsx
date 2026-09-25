"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VoxelMap } from "@/components/map/VoxelMap";
import { TerrainProvider } from "@/lib/terrain-context";
import { useEditorStore } from "@/lib/editor-store";
import type {
  ImageElement,
  SurfaceFace,
  TerrainBlockPosition,
} from "@/lib/terrains";
import { getSurfaceImagePosition } from "@/components/map/element-layout";
import { EditorOrbitCamera } from "./EditorOrbitCamera";
import { EditorViewportToolbar } from "./EditorViewportToolbar";
import type { SiteThemeMode } from "@/theme.config";

interface Props {
  themeMode: SiteThemeMode;
  onThemeModeChange: (mode: SiteThemeMode) => void;
}

export function EditorPreview({ themeMode, onThemeModeChange }: Props) {
  const [showBuildElements, setShowBuildElements] = useState(false);
  const [showSurroundings, setShowSurroundings] = useState(false);
  const doc = useEditorStore((s) => s.doc);
  const blockTypes = useEditorStore((s) => s.blockTypes);
  const activeTerrainId = useEditorStore((s) => s.activeTerrainId);
  const activeBlockTypeId = useEditorStore((s) => s.activeBlockTypeId);
  const requestTerrainSwitch = useEditorStore((s) => s.requestTerrainSwitch);
  const preflightTerrainSwitch = useEditorStore((s) => s.preflightTerrainSwitch);
  const commitTerrainSwitch = useEditorStore((s) => s.commitTerrainSwitch);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);
  const testMode = useEditorStore((s) => s.testMode);
  const buildEnabled = useEditorStore((s) => s.buildEnabled);
  const buildMode = useEditorStore((s) => s.buildMode);
  const imageSurfacePickEnabled = useEditorStore(
    (s) => s.imageSurfacePickEnabled,
  );
  const setImageSurfacePickEnabled = useEditorStore(
    (s) => s.setImageSurfacePickEnabled,
  );
  const cameraResetVersion = useEditorStore((s) => s.cameraResetVersion);
  const setTerrainBlock = useEditorStore((s) => s.setTerrainBlock);
  const updateElement = useEditorStore((s) => s.updateElement);
  const generatedSurroundings = useEditorStore((s) => s.generatedSurroundings);
  const mapData = useMemo(
    () => ({ terrains: doc, blockTypes, surroundings: generatedSurroundings }),
    [doc, blockTypes, generatedSurroundings],
  );
  const activeTerrain = doc.terrains.find((terrain) => terrain.id === activeTerrainId);
  const selectedElement = activeTerrain?.elements.find(
    (element) => element.id === selectedElementId,
  );

  useEffect(() => {
    if (!buildEnabled) setShowBuildElements(false);
  }, [buildEnabled]);

  const handleSetBlock = useCallback(
    (position: TerrainBlockPosition, blockTypeId: string | null) => {
      setTerrainBlock(activeTerrainId, position, blockTypeId);
    },
    [activeTerrainId, setTerrainBlock],
  );
  const terrainInteraction = useMemo(
    () => ({
      enabled: buildEnabled && !testMode,
      mode: buildMode,
      activeBlockTypeId,
      onSetBlock: handleSetBlock,
    }),
    [activeBlockTypeId, buildEnabled, buildMode, handleSetBlock, testMode],
  );
  const handlePickSurface = useCallback(
    (block: TerrainBlockPosition, face: SurfaceFace) => {
      if (!selectedElementId) return;
      const offset = 0.035;
      updateElement(activeTerrainId, selectedElementId, {
        surface: { block, face, offset },
        position: getSurfaceImagePosition(block, face, offset),
      } as Partial<ImageElement>);
      setImageSurfacePickEnabled(false);
    },
    [
      activeTerrainId,
      selectedElementId,
      setImageSurfacePickEnabled,
      updateElement,
    ],
  );
  const terrainSurfacePick = useMemo(
    () => ({
      enabled:
        imageSurfacePickEnabled &&
        !buildEnabled &&
        !testMode &&
        selectedElement?.type === "image",
      onPickSurface: handlePickSurface,
    }),
    [
      buildEnabled,
      handlePickSurface,
      imageSurfacePickEnabled,
      selectedElement?.type,
      testMode,
    ],
  );

  return (
    <TerrainProvider
      mapData={mapData}
      activeTerrainId={activeTerrainId}
      onActiveTerrainIdChange={requestTerrainSwitch}
      onTerrainNavigationPreflight={preflightTerrainSwitch}
      onTerrainNavigationCommit={commitTerrainSwitch}
      selectedElementId={selectedElementId}
      onSelectedElementIdChange={setSelectedElementId}
      previewMode={!testMode}
    >
      <div
        className="absolute inset-0"
        onContextMenu={(event) => event.preventDefault()}
      >
        <VoxelMap
          themeMode={themeMode}
          containerClassName="absolute inset-0"
          cameraController={({ frameTerrain }) => (
            <EditorOrbitCamera
              resetVersion={cameraResetVersion}
              frameTerrain={frameTerrain}
            />
          )}
          terrainInteraction={terrainInteraction}
          terrainSurfacePick={terrainSurfacePick}
          elementsInteractionDisabled={buildEnabled}
          showElements={!buildEnabled || showBuildElements}
          showSurroundings={showSurroundings}
        />
        <EditorViewportToolbar
          themeMode={themeMode}
          onThemeModeChange={onThemeModeChange}
          showBuildElements={showBuildElements}
          onShowBuildElementsChange={setShowBuildElements}
          showSurroundings={showSurroundings}
          onShowSurroundingsChange={setShowSurroundings}
        />
      </div>
    </TerrainProvider>
  );
}
