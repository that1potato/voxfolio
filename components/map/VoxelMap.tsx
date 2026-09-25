"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import dynamic from "next/dynamic";
import { Canvas, useThree } from "@react-three/fiber";
import type { Group } from "three";
import {
  Terrain,
  type TerrainInteraction,
  type TerrainSurfacePickInteraction,
} from "./Terrain";
import {
  AmbientCamera,
  MAP_CAMERA_FOV,
  type TerrainCameraTransition,
  type MapPresentationMode,
} from "./AmbientCamera";
import { MapKeyLight } from "./MapKeyLight";
import { SceneLights } from "./SceneLights";
import { TerrainElements } from "./TerrainElements";
import { SurroundingsLayer } from "./SurroundingsLayer";
import { prewarmWaterResources, WaterPlane } from "./WaterPlane";
import { PerfOverlay } from "./PerfOverlay";
import { perfEnabled } from "@/lib/perf-flag";
import { useTerrainContext } from "@/lib/terrain-context";
import {
  TERRAIN_REVEAL_DURATION_MS,
  type RadialRevealMask,
  type RadialRevealState,
} from "@/lib/radial-reveal";
import { siteTheme, type SiteThemeMode } from "@/theme.config";
import type {
  HoverCardMeta,
  ReadingContent,
} from "@/components/menu/overlay-types";
import type { Terrain as TerrainData } from "@/lib/terrains";
import {
  expandBounds,
  getGridBounds,
  getRevealMaxRadius,
  getUnionShadowTerrain,
  usePrefersReducedMotion,
  type TerrainRevealTransition,
  type XZBounds,
} from "./voxel-map-bounds";
import {
  IntroRevealDriver,
  TerrainRevealDriver,
  VoxelBackdropStage,
} from "./reveal-drivers";

// Lazily loaded so `@react-three/xr` stays in its own async chunk instead of
// the initial bundle; <XR> is inert until an immersive session starts.
const XRLayer = dynamic(() => import("./XRLayer"), {
  ssr: false,
  loading: () => null,
});

// In-scene reading panel, split into its own chunk and only mounted in an
// immersive session — keeps it out of the non-XR bundle.
const XRArticlePanel = dynamic(
  () => import("./XRArticlePanel").then((m) => m.XRArticlePanel),
  { ssr: false, loading: () => null },
);

// Grab handles (move / resize the whole package). Dynamically imported so
// `@react-three/handle` lands only in the XR chunk, mounted only in a session.
const XRPackageHandles = dynamic(
  () => import("./XRPackageHandles").then((m) => m.XRPackageHandles),
  { ssr: false, loading: () => null },
);

// XR tabletop placement, in the headset's local-floor space (metres). The world
// is authored at ~41 units across, so it is scaled down onto a virtual table in
// front of the user. Tunable — refine on-device.
const XR_TABLE_METERS = 1.2; // island footprint across its longest side
const XR_TABLE_HEIGHT = 1.0; // height of the island's base above the floor
const XR_TABLE_FORWARD = 0.95; // distance in front of the user at session start
// Ambient/hemisphere multiplier while presenting: immersive sessions lose the
// CSS VoxelBackdrop glow behind the canvas, so the fill runs slightly hotter.
const XR_FILL_BOOST = 1.15;
// Lowest rig-local Y the move handle may carry the package to (keeps the island
// base a touch above the physical floor).
const XR_MIN_RIG_Y = -(XR_TABLE_HEIGHT - 0.05);

// Reading panel: a vertical surface floating above the island, facing the user
// (who starts looking down −Z, so the plane's +Z front faces them). Tunable.
const XR_PANEL_LIFT = 0.6; // metres above the island base (clears taller terrain at 1.2m scale)
const XR_PANEL_WIDTH = 0.7;
const XR_PANEL_HEIGHT = 0.7;

interface CameraControllerOptions {
  frameTerrain?: TerrainData;
  cameraTransition?: TerrainCameraTransition;
}

type CameraController = ReactNode | ((options: CameraControllerOptions) => ReactNode);

interface Props {
  mode?: MapPresentationMode;
  themeMode?: SiteThemeMode;
  interactionDisabled?: boolean;
  activeSectionId?: string | null;
  readingPanelBottomPx?: number | null;
  onSelectSection?: (id: string, itemSlug?: string | null) => void;
  /** Plain-data reading content for the in-scene XR panel (XR only). */
  readingContent?: ReadingContent | null;
  /** Dismiss the active reading section (in-scene XR close button). */
  onCloseSection?: () => void;
  /** Drill into a list item from the in-scene XR list overview. */
  onSelectReadingItem?: (slug: string) => void;
  /** Back out of a drilled-in item to the list (in-scene XR back button). */
  onReadingBack?: () => void;
  /** Report the active immersive session mode up to the shell. */
  onXRModeChange?: (mode: XRSessionMode | null) => void;
  /** Hover-card metadata keyed by `<sectionId>/<itemSlug>`. */
  hoverCards?: Record<string, HoverCardMeta>;
  /** Override the container positioning class (default: full viewport). */
  containerClassName?: string;
  /** Replaces AmbientCamera, used by the editor's orbit controls. */
  cameraController?: CameraController;
  terrainInteraction?: TerrainInteraction;
  terrainSurfacePick?: TerrainSurfacePickInteraction;
  elementsInteractionDisabled?: boolean;
  showElements?: boolean;
  /** Render the decorative surroundings layer if available (default: true). */
  showSurroundings?: boolean;
}

/**
 * The floating voxel island with all main UI embedded as 3D objects.
 *
 * Reads the active terrain from TerrainContext — wrap the page in
 * <TerrainProvider/> to provide it.
 */
export function VoxelMap({
  mode = "map",
  themeMode = siteTheme.activeMode,
  interactionDisabled,
  activeSectionId,
  readingPanelBottomPx,
  onSelectSection,
  readingContent,
  onCloseSection,
  onSelectReadingItem,
  onReadingBack,
  onXRModeChange,
  hoverCards,
  containerClassName,
  cameraController,
  terrainInteraction,
  terrainSurfacePick,
  elementsInteractionDisabled,
  showElements = true,
  showSurroundings = true,
}: Props) {
  const {
    activeTerrain,
    blockTypes,
    activeSurroundings,
    doc,
    mapData,
    navigationRequest,
    clearNavigationRequest,
    completeTerrainNavigation,
  } = useTerrainContext();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Active immersive session mode, lifted from XRLayer (null when not in XR).
  const [xrMode, setXrMode] = useState<XRSessionMode | null>(null);
  // Report it up so the shell can swap the DOM reading overlay for the in-scene
  // panel while presenting.
  useEffect(() => {
    onXRModeChange?.(xrMode);
  }, [xrMode, onXRModeChange]);
  const revealState = useRef<RadialRevealState>({
    active: false,
    origin: [0, 0, 0],
    radius: 0,
    progress: 0,
  });
  // One-time intro: sweep the root terrain in with the same radial reveal used
  // for terrain swaps, so the island materialises instead of popping in on load.
  const [introActive, setIntroActive] = useState(false);
  const introRevealState = useRef<RadialRevealState>({
    active: false,
    origin: [0, 0, 0],
    radius: 0,
    progress: 0,
  });
  const introStartedRef = useRef(false);
  useEffect(() => {
    if (introStartedRef.current) return;
    introStartedRef.current = true;
    // Skip the sweep entirely for reduced-motion; the island renders at once.
    if (!prefersReducedMotion) setIntroActive(true);
  }, [prefersReducedMotion]);
  const completeIntro = useCallback(() => setIntroActive(false), []);
  const disableInteraction = interactionDisabled ?? mode === "reading";
  const transition = useMemo<TerrainRevealTransition | null>(() => {
    if (!navigationRequest || prefersReducedMotion) return null;

    const fromTerrain = doc.terrains.find(
      (terrain) => terrain.id === navigationRequest.fromTerrainId,
    );
    const toTerrain = doc.terrains.find(
      (terrain) => terrain.id === navigationRequest.targetTerrainId,
    );

    if (!fromTerrain || !toTerrain) return null;

    const fromSurroundings =
      mapData.surroundings?.[fromTerrain.id] ?? null;
    const toSurroundings = mapData.surroundings?.[toTerrain.id] ?? null;

    return {
      key: navigationRequest.key,
      durationMs: TERRAIN_REVEAL_DURATION_MS,
      fromTerrain,
      toTerrain,
      fromSurroundings,
      toSurroundings,
      origin: navigationRequest.origin,
      maxRadius: getRevealMaxRadius(
        navigationRequest.origin,
        [
          { terrain: fromTerrain, surroundings: fromSurroundings },
          { terrain: toTerrain, surroundings: toSurroundings },
        ],
        {
          width: typeof window === "undefined" ? 0 : window.innerWidth,
          height: typeof window === "undefined" ? 0 : window.innerHeight,
        },
      ),
    };
  }, [
    doc.terrains,
    mapData.surroundings,
    navigationRequest,
    prefersReducedMotion,
  ]);
  const transitionActive = transition !== null;
  const sceneInteractionDisabled = disableInteraction || transitionActive;

  useEffect(() => {
    if (!showSurroundings) return;
    const warm = () => {
      doc.terrains.forEach((terrain) => {
        prewarmWaterResources(
          terrain,
          mapData.surroundings?.[terrain.id] ?? null,
        );
      });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const id = idleWindow.requestIdleCallback(warm, { timeout: 500 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = globalThis.setTimeout(warm, 1);
    return () => globalThis.clearTimeout(id);
  }, [doc.terrains, mapData.surroundings, showSurroundings]);

  useEffect(() => {
    if (!navigationRequest) return;

    const fromTerrain = doc.terrains.find(
      (terrain) => terrain.id === navigationRequest.fromTerrainId,
    );
    const toTerrain = doc.terrains.find(
      (terrain) => terrain.id === navigationRequest.targetTerrainId,
    );

    if (!fromTerrain || !toTerrain) {
      revealState.current.active = false;
      clearNavigationRequest(navigationRequest.key);
      return;
    }

    if (prefersReducedMotion) {
      revealState.current.active = false;
      completeTerrainNavigation(navigationRequest.key);
    }
  }, [
    clearNavigationRequest,
    completeTerrainNavigation,
    doc.terrains,
    navigationRequest,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    if (!transition) {
      revealState.current.active = false;
      revealState.current.progress = 0;
    }
  }, [transition]);

  const completeTransition = useCallback((key: number) => {
    completeTerrainNavigation(key);
  }, [completeTerrainNavigation]);

  const outgoingReveal = useMemo<RadialRevealMask | undefined>(
    () => (transition ? { mode: "outside", state: revealState } : undefined),
    [transition],
  );
  const incomingReveal = useMemo<RadialRevealMask | undefined>(
    () => (transition ? { mode: "inside", state: revealState } : undefined),
    [transition],
  );
  // The intro masks the *active* (non-transition) world; it never coexists with
  // a swap, which only happens after the first mount has long settled.
  const introReveal = useMemo<RadialRevealMask | undefined>(
    () =>
      introActive ? { mode: "inside", state: introRevealState } : undefined,
    [introActive],
  );
  const cameraTransition = useMemo<TerrainCameraTransition | undefined>(
    () =>
      transition
        ? {
            fromTerrain: transition.fromTerrain,
            toTerrain: transition.toTerrain,
            state: revealState,
          }
        : undefined,
    [transition],
  );

  // Expand the shadow camera to cover the surroundings grid when present so
  // their voxels receive proper key-light shadows rather than being treated as
  // fully-lit geometry outside the shadow frustum.
  const surroundingsExtraRadius = useMemo(() => {
    if (!showSurroundings || !activeSurroundings) return 0;
    return Math.max(
      activeSurroundings.grid.width - activeTerrain.grid.width,
      activeSurroundings.grid.depth - activeTerrain.grid.depth,
    ) / 2;
  }, [showSurroundings, activeSurroundings, activeTerrain.grid]);
  const keyLightTerrain = useMemo(
    () => (transition ? getUnionShadowTerrain(transition) : activeTerrain),
    [activeTerrain, transition],
  );
  const renderedCameraController =
    typeof cameraController === "function"
      ? cameraController({
          frameTerrain: transition?.fromTerrain,
          cameraTransition,
        })
      : cameraController;

  // ── XR placement / mode-dependent scene shaping ──────────────────────────
  const isAR = xrMode === "immersive-ar";
  const inXR = xrMode === "immersive-ar" || xrMode === "immersive-vr";
  // Passthrough AR composites over the real room: the CSS sky backdrop is
  // dropped, and the water keeps only a padded ring around the island
  // (WaterPlane boundedEdge) whose outer edge fades into the passthrough.
  const showWater = showSurroundings;

  // Shrink the world onto a virtual tabletop in front of the user. Scaling about
  // the island centre keeps it framed; lights live inside the group so shadows
  // track the scaled island. Identity transform when not presenting.
  //
  // The transform is derived from the UNION of every terrain (+ its surroundings),
  // not the active one, so it is constant across in-place terrain swaps — the world
  // never resizes/repositions on the table in XR (the desktop auto-fit is unwanted
  // here; the headset owns the camera). Tradeoff: span tracks the largest terrain,
  // so smaller ones read a touch smaller but consistent, and a terrain authored
  // off-centre sits slightly off table-centre — both far less jarring than a jump.
  const tabletop = useMemo(() => {
    let bounds: XZBounds | null = null;
    for (const terrain of doc.terrains) {
      bounds = expandBounds(bounds, getGridBounds(terrain.grid));
      const surr = mapData.surroundings?.[terrain.id];
      if (surr) bounds = expandBounds(bounds, getGridBounds(surr.grid));
    }
    if (!bounds) return null;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const span =
      Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) + 1;
    return { cx, cz, scale: XR_TABLE_METERS / span };
  }, [doc.terrains, mapData.surroundings]);

  const groupScale = inXR && tabletop ? tabletop.scale : 1;
  // Base placement, factored so the grab-handle rig can sit between the two
  // pieces: the placement group carries the table anchor (world), the island
  // group carries the union-centre offset. Their composition reproduces the
  // pre-handles transform exactly, and the rig origin lands on the package's
  // visual centre so resize scales it in place.
  const placementPos = useMemo<[number, number, number]>(
    () =>
      inXR && tabletop ? [0, XR_TABLE_HEIGHT, -XR_TABLE_FORWARD] : [0, 0, 0],
    [inXR, tabletop],
  );
  const islandLocal = useMemo<[number, number, number]>(
    () =>
      inXR && tabletop
        ? [-tabletop.scale * tabletop.cx, 0, -tabletop.scale * tabletop.cz]
        : [0, 0, 0],
    [inXR, tabletop],
  );
  // The grab-handle rig (identity base; handles mutate it imperatively).
  const rigRef = useRef<Group>(null);

  const worldChildren = (
    <>
      <SceneLights
        themeMode={themeMode}
        fillBoost={inXR ? XR_FILL_BOOST : 1}
      />
      <MapKeyLight
        terrain={keyLightTerrain}
        extraRadius={transition ? 0 : surroundingsExtraRadius}
        themeMode={themeMode}
        worldScale={groupScale}
      />
      {transition && (
        <TerrainRevealDriver
          transition={transition}
          revealState={revealState}
          onComplete={completeTransition}
        />
      )}
      {introActive && (
        <IntroRevealDriver
          terrain={activeTerrain}
          surroundings={activeSurroundings ?? null}
          revealState={introRevealState}
          onComplete={completeIntro}
        />
      )}
      {showWater && transition ? (
        <>
          <WaterPlane
            terrain={transition.fromTerrain}
            surroundings={transition.fromSurroundings ?? undefined}
            themeMode={themeMode}
            radialReveal={outgoingReveal}
            boundedEdge={isAR}
          />
          <WaterPlane
            terrain={transition.toTerrain}
            surroundings={transition.toSurroundings ?? undefined}
            themeMode={themeMode}
            radialReveal={incomingReveal}
            boundedEdge={isAR}
          />
        </>
      ) : (
        showWater && (
          <WaterPlane
            terrain={activeTerrain}
            surroundings={activeSurroundings ?? undefined}
            themeMode={themeMode}
            radialReveal={introReveal}
            boundedEdge={isAR}
          />
        )
      )}
      {showSurroundings && transition ? (
        <>
          {transition.fromSurroundings && (
            <SurroundingsLayer
              surroundings={transition.fromSurroundings}
              themeMode={themeMode}
              radialReveal={outgoingReveal}
            />
          )}
          {transition.toSurroundings && (
            <SurroundingsLayer
              surroundings={transition.toSurroundings}
              themeMode={themeMode}
              radialReveal={incomingReveal}
            />
          )}
        </>
      ) : (
        showSurroundings &&
        activeSurroundings && (
          <SurroundingsLayer
            surroundings={activeSurroundings}
            themeMode={themeMode}
            radialReveal={introReveal}
          />
        )
      )}
      {transition ? (
        <>
          <Terrain
            terrain={transition.fromTerrain}
            blockTypes={blockTypes}
            themeMode={themeMode}
            radialReveal={outgoingReveal}
          />
          <Terrain
            terrain={transition.toTerrain}
            blockTypes={blockTypes}
            themeMode={themeMode}
            radialReveal={incomingReveal}
          />
        </>
      ) : (
        <Terrain
          terrain={activeTerrain}
          blockTypes={blockTypes}
          themeMode={themeMode}
          interaction={terrainInteraction}
          surfacePick={terrainSurfacePick}
          radialReveal={introReveal}
        />
      )}
      {showElements && transition ? (
        <>
          <TerrainElements
            elements={transition.fromTerrain.elements}
            activeSectionId={activeSectionId}
            onSelectSection={onSelectSection}
            hoverCards={hoverCards}
            themeMode={themeMode}
            interactionDisabled
            suppressHoverCards={inXR}
            radialReveal={outgoingReveal}
            worldScale={groupScale}
          />
          <TerrainElements
            elements={transition.toTerrain.elements}
            activeSectionId={activeSectionId}
            onSelectSection={onSelectSection}
            hoverCards={hoverCards}
            themeMode={themeMode}
            interactionDisabled={elementsInteractionDisabled}
            suppressHoverCards={inXR}
            radialReveal={incomingReveal}
            worldScale={groupScale}
          />
        </>
      ) : (
        showElements && (
          <TerrainElements
            elements={activeTerrain.elements}
            activeSectionId={activeSectionId}
            onSelectSection={onSelectSection}
            hoverCards={hoverCards}
            themeMode={themeMode}
            interactionDisabled={
              elementsInteractionDisabled || sceneInteractionDisabled
            }
            suppressHoverCards={inXR}
            radialReveal={introReveal}
            worldScale={groupScale}
          />
        )
      )}
    </>
  );

  // The world is wrapped in a placement → rig → island stack: the placement
  // group carries the (React-driven) table anchor, the rig is the grab-handle
  // target (identity base, mutated by the move/resize handles and reset on
  // session exit), and the island group carries the union-centre offset +
  // tabletop scale. The reading panel and handles live inside the rig, so the
  // island + panel move/scale together as one package. Outside an immersive
  // session every group is identity, and toggling a session only changes
  // props — worldChildren never remount.
  const world = (
    <group position={placementPos}>
      <group ref={rigRef}>
        <group position={islandLocal} scale={groupScale}>
          {worldChildren}
        </group>
        {inXR && activeSectionId && readingContent && (
          <XRArticlePanel
            content={readingContent}
            themeMode={themeMode}
            isAR={isAR}
            position={[0, XR_PANEL_LIFT, 0]}
            width={XR_PANEL_WIDTH}
            height={XR_PANEL_HEIGHT}
            onClose={onCloseSection}
            onSelectItem={onSelectReadingItem}
            onBack={onReadingBack}
          />
        )}
      </group>
      {/* Window chrome sits beside the rig (not inside it) so it can track the
          package at a constant physical size while moving/resizing it. */}
      {inXR && (
        <XRPackageHandles
          targetRef={rigRef}
          halfDepth={XR_TABLE_METERS / 2}
          minY={XR_MIN_RIG_Y}
        />
      )}
    </group>
  );

  const sceneChildren = (
    <>
      {world}
      <RigTransformReset rigRef={rigRef} presenting={inXR} />
      {renderedCameraController === undefined ? (
        <AmbientCamera
          mode={mode}
          cameraTransition={cameraTransition}
          readingPanelBottomPx={readingPanelBottomPx}
        />
      ) : (
        renderedCameraController
      )}
      {perfEnabled && <PerfOverlay />}
    </>
  );

  return (
    <div
      aria-hidden={disableInteraction}
      className={[
        containerClassName ?? "fixed inset-0 z-0",
        disableInteraction ? "pointer-events-none" : "",
        "voxel-map-shell bg-[#0e0a08]",
      ].join(" ")}
    >
      {/* Hidden in any immersive session: AR shows the room through the
          transparent canvas; VR draws its own in-scene sky. */}
      {!inXR && (
        <VoxelBackdropStage
          themeMode={themeMode}
          activeAtmosphere={activeTerrain.atmosphere}
          showReadingSky={mode === "reading"}
          transition={transition}
        />
      )}
      <Canvas
        className="voxel-map-canvas"
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        camera={{
          position: [-4.3, 40.5, 34.7],
          fov: MAP_CAMERA_FOV,
          near: 1,
          far: 10000,
        }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => gl.setClearAlpha(0)}
      >
        <XRLayer
          themeMode={themeMode}
          atmosphere={activeTerrain.atmosphere}
          onModeChange={setXrMode}
        >
          {sceneChildren}
        </XRLayer>
      </Canvas>
    </div>
  );
}

/**
 * Clears any handle-driven move/resize on the package rig whenever we're not in
 * an immersive session, so leftover transforms don't corrupt the desktop view
 * and re-entering XR starts from the default framing. Lives inside the Canvas so
 * it can invalidate a frame under frameloop="demand".
 */
function RigTransformReset({
  rigRef,
  presenting,
}: {
  rigRef: RefObject<Group | null>;
  presenting: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (presenting) return;
    const rig = rigRef.current;
    if (!rig) return;
    rig.position.set(0, 0, 0);
    rig.scale.set(1, 1, 1);
    rig.quaternion.identity();
    invalidate();
  }, [presenting, invalidate, rigRef]);
  return null;
}
