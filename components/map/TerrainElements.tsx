"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import { VoxelTitle } from "./text/VoxelTitle";
import { VoxelCaption } from "./text/VoxelCaption";
import { VoxelButton3D } from "./VoxelButton3D";
import { VoxelNixieCounter } from "./VoxelNixieCounter";
import { MapImagePlane } from "./MapImagePlane";
import { useTerrainContext } from "@/lib/terrain-context";
import {
  getButtonContentMode,
  type ButtonElement,
  type TerrainElement,
} from "@/lib/terrains";
import {
  DEFAULT_BUTTON_ELEMENT_APPEARANCE,
  DEFAULT_COUNTER_DIGITS,
  DEFAULT_COUNTER_ELEMENT_APPEARANCE,
  DEFAULT_TEXT_ELEMENT_APPEARANCE,
} from "@/lib/map-element-appearance";
import { resolveThemeColor } from "@/lib/theme-colors";
import type { SiteThemeMode } from "@/theme.config";
import type { HoverCardMeta } from "@/components/menu/overlay-types";
import {
  getElementPlaneRotation,
  getSurfaceImagePosition,
} from "./element-layout";
import { getElementSelectionBoxes } from "./element-bounds";
import {
  radialRevealFactor,
  TERRAIN_REVEAL_RISE,
  type RadialRevealMask,
} from "@/lib/radial-reveal";
import { prewarmWaterResources } from "./WaterPlane";

interface Props {
  elements: TerrainElement[];
  activeSectionId?: string | null;
  onSelectSection?: (id: string, itemSlug?: string | null) => void;
  hoverCards?: Record<string, HoverCardMeta>;
  themeMode: SiteThemeMode;
  interactionDisabled?: boolean;
  /** Suppress DOM hover cards (drei <Html> doesn't composite into XR). */
  suppressHoverCards?: boolean;
  radialReveal?: RadialRevealMask;
  /** Ancestor XR tabletop-rig scale, for lights with metre-based falloff. */
  worldScale?: number;
}

/**
 * Iterates a terrain's element list and dispatches each to the matching
 * voxel-text/button component.
 *
 * Click behavior depends on previewMode (from TerrainContext):
 *   - editor preview: select the element for editing
 *   - public site: switch terrain, open an MDX overlay, or follow a link
 */
export function TerrainElements({
  elements,
  activeSectionId,
  onSelectSection,
  hoverCards,
  themeMode,
  interactionDisabled = false,
  suppressHoverCards = false,
  radialReveal,
  worldScale = 1,
}: Props) {
  const {
    doc,
    mapData,
    navigateTerrain,
    previewMode,
    selectedElementId,
    setSelectedElementId,
  } =
    useTerrainContext();

  const handleClickElement = (el: TerrainElement) => {
    if (!previewMode) return;
    setSelectedElementId(el.id);
  };

  const handleButtonClick = (el: ButtonElement) => {
    if (previewMode) {
      setSelectedElementId(el.id);
      return;
    }
    if (el.targetTerrainId) {
      navigateTerrain(el.targetTerrainId, { origin: el.position });
      return;
    }
    if (el.contentSectionId) {
      onSelectSection?.(el.contentSectionId, el.contentItemSlug ?? null);
      return;
    }
    if (el.href) {
      if (el.href.startsWith("https:")) {
        window.open(el.href, "_blank", "noopener,noreferrer");
        return;
      }
      window.location.href = el.href;
    }
  };
  const handleButtonPointerDown = (el: ButtonElement) => {
    if (previewMode || !el.targetTerrainId) return;
    navigateTerrain(el.targetTerrainId, { origin: el.position });
  };
  const handleButtonPrewarm = (el: ButtonElement) => {
    if (!el.targetTerrainId) return;
    const terrain = doc.terrains.find((item) => item.id === el.targetTerrainId);
    if (!terrain) return;
    prewarmWaterResources(
      terrain,
      mapData.surroundings?.[terrain.id] ?? null,
    );
  };

  return (
    <group>
      {elements.map((el) => {
        const isSelected = previewMode && el.id === selectedElementId;
        const elementScale = el.scale ?? 1;
        if (el.type === "title") {
          return (
            <group
              key={el.id}
              onClick={
                interactionDisabled
                  ? undefined
                  : (event) => {
                      event.stopPropagation();
                      handleClickElement(el);
                    }
              }
            >
              <VoxelTitle
                position={el.position}
                rotationY={el.rotationY ?? 0}
                orientation={el.orientation}
                elementScale={elementScale}
                image={el.image}
                color={resolveThemeColor(
                  el.appearance?.color ??
                    DEFAULT_TEXT_ELEMENT_APPEARANCE.color,
                  themeMode,
                )}
                radialReveal={radialReveal}
              >
                {el.text}
              </VoxelTitle>
              {isSelected && <SelectionMarker element={el} />}
            </group>
          );
        }
        if (el.type === "caption") {
          return (
            <group
              key={el.id}
              onClick={
                interactionDisabled
                  ? undefined
                  : (event) => {
                      event.stopPropagation();
                      handleClickElement(el);
                    }
              }
            >
              <VoxelCaption
                position={el.position}
                rotationY={el.rotationY ?? 0}
                orientation={el.orientation}
                elementScale={elementScale}
                image={el.image}
                color={resolveThemeColor(
                  el.appearance?.color ??
                    DEFAULT_TEXT_ELEMENT_APPEARANCE.color,
                  themeMode,
                )}
                radialReveal={radialReveal}
              >
                {el.text}
              </VoxelCaption>
              {isSelected && <SelectionMarker element={el} />}
            </group>
          );
        }
        if (el.type === "button") {
          const active = !!activeSectionId && el.contentSectionId === activeSectionId;
          const contentMode = getButtonContentMode(el);
          const hoverCard = el.hoverCardItem
            ? hoverCards?.[el.hoverCardItem]
            : undefined;
          return (
            <RadialRevealGate
              key={el.id}
              position={el.position}
              radialReveal={radialReveal}
            >
              <VoxelButton3D
                label={el.text}
                hoverCard={hoverCard}
                suppressHoverCards={suppressHoverCards}
                themeMode={themeMode}
                position={el.position}
                rotationY={el.rotationY ?? 0}
                orientation={el.orientation}
                width={el.width ?? 7}
                depth={el.depth ?? 1.8}
                scale={elementScale}
                active={active || isSelected}
                image={el.image}
                contentMode={contentMode}
                contentPadding={el.contentPadding}
                mainColor={resolveThemeColor(
                  el.appearance?.main ??
                    DEFAULT_BUTTON_ELEMENT_APPEARANCE.main,
                  themeMode,
                )}
                labelColor={resolveThemeColor(
                  el.appearance?.text ??
                    DEFAULT_BUTTON_ELEMENT_APPEARANCE.text,
                  themeMode,
                )}
                edgeColor={resolveThemeColor(
                  el.appearance?.edge ??
                    DEFAULT_BUTTON_ELEMENT_APPEARANCE.edge,
                  themeMode,
                )}
                onClick={
                  interactionDisabled ? undefined : () => handleButtonClick(el)
                }
                onPointerDown={
                  interactionDisabled
                    ? undefined
                    : () => handleButtonPointerDown(el)
                }
                onPointerOver={
                  interactionDisabled
                    ? undefined
                    : () => handleButtonPrewarm(el)
                }
                interactionDisabled={interactionDisabled}
              />
              {isSelected && <SelectionMarker element={el} />}
            </RadialRevealGate>
          );
        }
        if (el.type === "image") {
          const position = el.surface
            ? getSurfaceImagePosition(
                el.surface.block,
                el.surface.face,
                el.surface.offset,
              )
            : el.position;
          return (
            <RadialRevealGate
              key={el.id}
              position={el.position}
              radialReveal={radialReveal}
              onClick={
                interactionDisabled
                  ? undefined
                  : (event) => {
                      event.stopPropagation();
                      handleClickElement(el);
                    }
              }
            >
              <MapImagePlane
                src={el.src}
                alt={el.alt}
                position={position}
                rotationY={el.surface ? 0 : (el.rotationY ?? 0)}
                orientation={el.orientation}
                surfaceFace={el.surface?.face}
                scale={elementScale}
                width={el.width}
                height={el.height}
                opacity={el.opacity ?? 1}
              />
              {isSelected && <SelectionMarker element={el} />}
            </RadialRevealGate>
          );
        }
        if (el.type === "counter") {
          return (
            <RadialRevealGate
              key={el.id}
              position={el.position}
              radialReveal={radialReveal}
              onClick={
                interactionDisabled
                  ? undefined
                  : (event) => {
                      event.stopPropagation();
                      handleClickElement(el);
                    }
              }
            >
              <VoxelNixieCounter
                position={el.position}
                rotationY={el.rotationY ?? 0}
                orientation={el.orientation}
                elementScale={elementScale}
                digits={el.digits ?? DEFAULT_COUNTER_DIGITS}
                value={el.value}
                endpoint={el.endpoint}
                glowColor={resolveThemeColor(
                  el.appearance?.glow ??
                    DEFAULT_COUNTER_ELEMENT_APPEARANCE.glow,
                  themeMode,
                )}
                glassColor={
                  el.appearance?.glass
                    ? resolveThemeColor(el.appearance.glass, themeMode)
                    : undefined
                }
                radialReveal={radialReveal}
                worldScale={worldScale}
              />
              {isSelected && <SelectionMarker element={el} />}
            </RadialRevealGate>
          );
        }
        return null;
      })}
    </group>
  );
}

function RadialRevealGate({
  children,
  onClick,
  position,
  radialReveal,
}: {
  children: ReactNode;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  position: [number, number, number];
  radialReveal?: RadialRevealMask;
}) {
  const groupRef = useRef<Group>(null);

  // Bloom the whole element (box + label) in/out with the wavefront instead of
  // popping it. Scale about the element's own anchor (group sits at the origin,
  // children carry absolute positions), so compensate the translation:
  //   x' = s * x + position * (1 - s)
  const applyReveal = () => {
    const group = groupRef.current;
    if (!group) return;
    const factor = radialRevealFactor(radialReveal, position);
    const visible = factor > 0.001;
    group.visible = visible;
    const s = visible ? factor : 0.0001;
    group.scale.setScalar(s);
    const k = 1 - s;
    group.position.set(
      position[0] * k,
      position[1] * k - k * TERRAIN_REVEAL_RISE,
      position[2] * k,
    );
  };

  useLayoutEffect(applyReveal);
  useFrame(applyReveal);

  return (
    <group ref={groupRef} onClick={onClick}>
      {children}
    </group>
  );
}

function SelectionMarker({ element }: { element: TerrainElement }) {
  return (
    <>
      {getElementSelectionBoxes(element).map((box, index) => (
        <group
          key={index}
          position={box.position}
          rotation={[0, box.rotationY, 0]}
          scale={box.scale}
        >
          <group rotation={getElementPlaneRotation(box.orientation)}>
            <mesh position={box.center}>
              <boxGeometry args={box.size} />
              <meshBasicMaterial color="#facc15" wireframe />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}
