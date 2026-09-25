# voxfolio — Claude Context

## What this is
voxfolio is an open-source template that turns a personal site's homepage into a 3D voxel island. It uses Next.js 15 (App Router), TypeScript and Tailwind CSS. The island is built with React Three Fiber (r3f) and Three.js, and buttons on it open MDX content in a frosted-glass overlay. A visual map editor lives at `/editor`. User-facing docs are in `README.md`; this file covers the architecture and the gotchas.

## Where edits land

- **`site.config.ts`**
  - `site`: `{ name, description }`, used only for document metadata and the PWA manifest. The 3D title is a terrain `title` element.
  - `sections[]`: `{ id, label, kind }`, the MDX content that exists.
  - `palette`: shared UI color tokens. It is imported by `tailwind.config.ts`, `InstancedVoxels`, `Voxel`, `VoxelButton3D` and `lib/map-element-appearance.ts`, and the typography color `"cream"` resolves through it. **Keep this export and its keys.**
- **`data/block-types.json`**: paintable block types (light and dark color for each) in order, plus `defaultBlockTypeId`.
- **`data/terrains/`**: `index.json` (`version: 2`, `rootTerrainId`, ordered `terrainIds`) plus one `<id>.json` per terrain. Edit them by hand or in `/editor`.
- **`atmosphere.config.ts`**: named mood presets (`sky`, `water`, optional `surroundings` palette). A terrain opts in with `"atmosphere": "<id>"`. The file ships with `dusk`.

Other root files tune look and feel:
- `theme.config.ts`: `activeMode`, the light/dark mode the page loads in. The in-page `ThemeSwitcher` changes it for the session only.
- `article.config.ts`: reading-surface tokens, turned into `--article-*` CSS variables for `app/article.css`.

The map's own look is set in `components/map/voxel-backdrop.config.ts`, `water.config.ts` and `scene-lighting.config.ts`.

## Directory structure
```
app/                     App Router: / (page.tsx), layout, manifest, icons
  editor/                Map editor route (env-gated, force-dynamic)
  api/editor/            Dev-only write routes: map-data (save), terrains/[id] (delete),
                         generated-surroundings/[id] (generate), assets (image upload)
  dev/xr-panel/          Dev-only desktop preview of the XR reading panel
  globals.css            Scene shell, CSS sky backdrop (@property sky colors), .theme-switcher, .xr-pill
  article.css            Reading surface (.article-*) and hover card (.hover-card*) styles
components/map/          3D scene (production) + look-and-feel configs
components/editor/       Map editor UI (only loaded on /editor)
components/menu/         Home shell: MenuShell, SectionOverlay, ThemeSwitcher, EnterXRButton, overlay-types
components/article/      Reading-surface primitives (glass surface, theme scope, masthead, mosaic filter)
components/mdx/          MDX renderer + <Figure>/<YouTube>/<Video>
content/                 MDX, one file (panel) or folder (list) per section id
data/                    block-types.json, terrains/, generated-surroundings/
lib/                     Terrain schema/validation, contexts, stores, loaders (see below)
public/fonts/msdf/       MSDF atlases for the XR panel (OFL; see its README)
public/map-assets/       Editor image uploads
scripts/generate-msdf-fonts.sh   Rebuilds the MSDF atlases
```

## Map editor at `/editor`

The editor isn't linked from the public site. It edits `data/` visually, and its 3D preview is the production `VoxelMap`, so the preview always matches the live look.

- **Gating** has two layers; keep both:
  1. `app/editor/layout.tsx` returns `notFound()` in production unless `NEXT_PUBLIC_ENABLE_EDITOR=1`. The value is inlined at build time.
  2. Every `app/api/editor/*` handler returns 403 unless `NODE_ENV === "development"`. The client disables the matching buttons with the same check.

  A production editor can therefore only view, edit in memory, and export. The layout also sets noindex metadata.
- **Persistence**: `lib/editor-store.ts` is a session-only Zustand store with saved baselines and dirty tracking (a JSON compare). **Save Changes** (Ctrl/Cmd+S) writes the dirty block types plus the *active* terrain in one transaction with rollback, and appends new terrain ids to the manifest. Switching away from a dirty terrain opens `UnsavedTerrainDialog`.
- **Import/Export Current**: works on the active terrain only, and an imported file's id must match.
- **Ground painter** (`TilePainter`): paints, erases, fills or clears the `y = 0` layer. The grid auto-fits the content plus `EDGE_MARGIN` (3 cells).
- **3D builder** (`EditorPreview` + `Terrain` interaction): adds blocks onto exposed faces or deletes blocks at `y >= 0`. `EditorOrbitCamera` handles right-drag orbit, middle-drag pan and wheel zoom; **Reset View** returns to the production framing (`getDefaultMapCameraFrame`).
- **Elements**: title, caption, button, image and counter. New elements get ids `t-/c-/b-/i-/n-001…`. `CounterElementFields` edits `digits`, `value` and `endpoint`. The endpoint commits on blur or Enter so half-typed URLs aren't fetched.
- **Button actions**: at most one of `targetTerrainId`, `contentSectionId` (+ `contentItemSlug`) or `href`. Separately, `hoverCardItem` is chosen from `availableHoverItems`, which `app/editor/page.tsx` builds from every `kind: "list"` section.
- **Atmosphere picker**: `setTerrainAtmosphere(terrainId, atmosphere | undefined)`. Choosing "(default)" removes the key.
- **Gen Surroundings**: POSTs the in-memory terrain with a random seed. The route writes `data/generated-surroundings/<id>.json` **immediately, outside Save/Revert**. Deleting a persisted terrain also removes its surroundings file.
- **Test toggle**: flips `previewMode`. When it's on, buttons navigate instead of selecting. Content-section buttons still do nothing, because `EditorPreview` passes no `onSelectSection`, and hover cards never render in the editor (no `hoverCards` prop).

## Multi-terrain navigation

A button with `targetTerrainId` swaps the scene to another terrain in place, with no page reload:

- `navigateTerrain` in `terrain-context` issues a keyed navigation request.
- `VoxelMap` builds a `TerrainRevealTransition`. The outgoing terrain sprouts out and the incoming one sprouts in along a radial wavefront from the clicked button (`TerrainRevealDriver`, `lib/radial-reveal.ts`).
- The CSS sky crossfades (`VoxelBackdropCrossfade`) and `AmbientCamera` lerps to the new terrain's framing.
- Reduced motion skips the animation.
- The root terrain also plays a one-time intro reveal (`IntroRevealDriver`).

## Atmospheres + generated surroundings

- `getAtmosphere(id)` returns `undefined` for unknown or missing ids, and the default look is used.
- A preset overrides the sky and the water in **both** light and dark mode:
  - The sky is applied by `getVoxelBackdropVariant` / `getVoxelBackdropStyle` (CSS backdrop) and by `XRLayer`'s VR sky.
  - The water is applied by `waterColorsFor(terrain.atmosphere, mode)` in `WaterPlane`.
  - Keep `water.horizon === sky.skyBottom`.
- `lib/surroundings/generate.ts` generates surroundings deterministically from a seed. Its signature is `generateSurroundings(terrain, { seed?, blossomBias?, palette? })`.
- **The surroundings palette is embedded in each generated JSON file.** After you change an atmosphere's `surroundings` or the generator's default `PALETTE`, regenerate (Gen Surroundings) or the old colors stay.
- `isSurroundingsStale` exists but nothing calls it. Regenerate yourself after changing a terrain's footprint.
- Surroundings are optional: `loadGeneratedSurroundings` returns null when the file is missing (ENOENT) or isn't version 2.

## Mixed reality (WebXR)

Immersive mode is built on `@react-three/xr` v6 and is always enabled, but it stays out of the desktop critical path:

- XR code sits in async chunks.
- `<XR>` does nothing until a session starts.
- The entry button renders nothing when immersive sessions aren't supported.

To test, use the Immersive Web Emulator browser extension, or a real headset over HTTPS (`npm run dev:https`, which is `next dev --experimental-https`; the certificates go to the gitignored `certificates/`).

- **Entry**: `components/menu/EnterXRButton.tsx` ("View in your space") imports `lib/xr-store` dynamically inside its handlers. It tries `immersive-ar` first (Quest passthrough), then `immersive-vr` (Vision Pro Safari and VR headsets).
- **Store**: one shared `createXRStore()` in `lib/xr-store.ts`, with `offerSession: false` and **`emulate: false`**. The built-in iwer emulator bundles its own three@0.165, a second Three.js copy that breaks rendering. Only reach this module through a dynamic boundary (EnterXRButton's `import()`, the `next/dynamic` XRLayer, or the dev-only XRPanelPreview). A static import would ship XR to every visitor.
- **Scene wrapper**: `components/map/XRLayer.tsx` is always mounted through `next/dynamic` in `VoxelMap`. It contains:
  - **`KickRender`**: because the layer mounts after the Canvas's first paint, it invalidates a few frames under demand rendering. Without it nothing draws until something else invalidates.
  - `SessionReporter`, which lifts the mode up to `VoxelMap` and then `MenuShell`.
  - `SessionFrameloop`, which sets the frameloop to `always` while presenting and back to `demand` with an invalidate on exit.
  - A VR-only gradient sky from the terrain's atmosphere/mode.
- **Tabletop rig** (`VoxelMap`): a placement → rig (`rigRef`, the grab-handle target) → island group stack.
  - It is **always mounted**; toggling a session only changes props, so the world children never remount.
  - `RigTransformReset` clears handle transforms on exit.
  - The scale (`groupScale`, 1.2 m footprint) comes from the union of **all** terrains and their surroundings, so it stays constant across swaps.
  - `XRPackageHandles` provides move/resize handles (0.3×–2.5×).
- **In-XR behavior**:
  - `AmbientCamera` returns early while `gl.xr.isPresenting`.
  - AR drops the CSS backdrop and bounds the water to a ring that fades into passthrough (`WaterPlane` `boundedEdge`, computed in island space).
  - drei `<Html>` hover cards are suppressed.
  - `MenuShell` swaps the DOM `SectionOverlay` for `XRArticlePanel` (@react-three/uikit, MSDF fonts, a composition layer).
  - Button pointer events work with controller and hand rays.
- **Reading content for XR**: `lib/content.ts` `markdownToBlocks` flattens MDX into `ReadingContent` blocks. It is a line parser with these limits:
  - It drops fenced code, `<Video>` and unknown components.
  - `####` headings and `>` quotes come through as literal text.
  - Nested lists are flattened.
  - It reads only double-quoted JSX attributes.
- **Fonts**: the MSDF charset is Latin-only (117 glyphs). Changing the article fonts means rerunning `scripts/generate-msdf-fonts.sh` and updating `FONT_FAMILIES` plus the `fontFamily` strings in `XRArticlePanel.tsx`.

## Key 3D components (`components/map/`)
| File | Role |
|------|------|
| `VoxelMap.tsx` | Canvas root (`frameloop="demand"`, shadows, transparent). Reads the active terrain from `TerrainContext` and composes lights, water, surroundings, terrain, elements, camera, reveal drivers, CSS backdrop and the XR tabletop rig |
| `AmbientCamera.tsx` | Responsive camera. Binary-searches the distance that fits the terrain bbox plus elements, lerps on swaps, has `map`/`reading` modes, and drives demand frames until it settles. Exports `MAP_CAMERA_FOV` and `getDefaultMapCameraFrame` (used by the editor) |
| `Terrain.tsx` | Renders layered block-type masks from `terrain.grid` through `InstancedVoxels`. Also handles the editor's hover preview, add/delete on faces, and surface picking |
| `InstancedVoxels.tsx` | Batched cube renderer: one `InstancedMesh` per list, with per-instance color, light/dark crossfade, optional emissive, and radial-reveal shader injection (including the shadow depth material). Keyed by instance count, and invalidates after writing matrices. The perf-critical primitive |
| `Voxel.tsx` | A single-cube primitive; nothing imports it (hot paths use `InstancedVoxels`) |
| `WaterPlane.tsx` (+ `water.config.ts`) | Shader-patched water. Uses a BFS land-distance field (module-cached per terrain + surroundings, never evicted) for shore foam and a fading grid, plus ripple normals, a horizon fade into the sky, radial-reveal masking and the AR `boundedEdge` ring. `prewarmWaterResources` warms caches at idle |
| `SurroundingsLayer.tsx` | Renders a `GeneratedSurroundings` grid (its own embedded palette) as one instanced batch |
| `VoxelBackdrop.tsx` (+ `voxel-backdrop.config.ts`) | CSS gradient sky behind the canvas, themed by **mode plus the terrain's atmosphere preset**, with reading-mode clouds or moon/stars decor. No three.js fog; depth comes from this backdrop |
| `reveal-drivers.tsx` | `TerrainRevealDriver` and `IntroRevealDriver` (advance the shared `RadialRevealState` and invalidate each frame), and `VoxelBackdropStage`/`VoxelBackdropCrossfade` (sky crossfade keyed on the transition) |
| `voxel-map-bounds.ts` | Grid bounds, reveal max radius (including viewport coverage), union shadow terrain, `usePrefersReducedMotion` |
| `SceneLights.tsx` / `MapKeyLight.tsx` (+ `scene-lighting.config.ts`) | Theme-crossfaded ambient, hemisphere and rim lights plus exposure, with an XR `fillBoost`. The key light is the shadow-casting sun, with a frustum fitted to the terrain, elements and surroundings, **scaled by `worldScale`** |
| `TerrainElements.tsx` | Dispatches `terrain.elements` to title, caption, button, image or counter. Handles clicks (select in the editor; otherwise terrain nav, section overlay, or href: `https:` opens a new tab), the water prewarm on hover, the reveal gate, and selection wireframes. Looks up hover cards by `el.hoverCardItem` |
| `VoxelButton3D.tsx` | Voxel sign (ground or upright) with a border rail, an auto-fit label and/or image icon, and an invisible hit box (works with XR rays). Shows a `HoverCard` through drei `<Html>` and owns its enter/exit phase: the exit waits for the card's `article-glass-disperse` `animationend`, falling back to `articleTheme.motion.durationMs + 100` ms |
| `HoverCard.tsx` | Presentational frosted DOM card (category eyebrow, summary, `.hover-card-tag` pills) that reuses the article glass; its `phase` (`enter`/`in`/`out`) is driven by `VoxelButton3D` |
| `VoxelNixieCounter.tsx` | Zero-padded glowing digits (`fetched ?? value ?? 0`, via `useCounterValue(endpoint)`) with optional tube panes and a point light **scaled by `worldScale`** |
| `MapImagePlane.tsx` | Textured planes for image elements, surface-anchored images, button icons and title/caption attachments. Animated GIFs are decoded with gifuct-js onto a CanvasTexture; playback pauses while the tab is hidden and invalidates every frame |
| `VoxelText3D.tsx` + `text/*` | 5×7 bitmap voxel font (A–Z, a–z, 0–9, space and `. , - / ! ?`), one instanced batch per text block. `VoxelTitle`, `VoxelCaption`, `VoxelButtonLabel` (auto-fit) and `VoxelTextElement` are wrappers. `text/typography.ts` is the single source of truth for levels |
| `element-layout.ts` / `element-bounds.ts` | Orientation math, button content layout, surface-anchored image placement, element bounds for camera fitting and selection |
| `XRLayer.tsx`, `XRArticlePanel.tsx`, `XRPackageHandles.tsx`, `XRPanelPreview.tsx` | XR session wrapper, in-scene reading panel, grab handles, and the `/dev/xr-panel` harness client |
| `PerfOverlay.tsx` | Dev-only r3f-perf HUD, dynamically imported behind `lib/perf-flag.ts` |
| `components/editor/EditorOrbitCamera.tsx` | Editor-only full-sphere orbit, pan and zoom, reset to production framing |

## Data layer (`lib/`)
| File | Role |
|------|------|
| `terrains/` (`types.ts`, `validation.ts`, `grid.ts`, `index.ts`) | Map, terrain, block-type, layer and element types; strict validators; grid and mask helpers (enumerate, set block, reframe/grow/fit, content bounds) |
| `terrain-context.tsx` | `TerrainProvider`/`useTerrainContext`: map data, active terrain (controlled or uncontrolled), active surroundings, selected element, preview mode, keyed navigation requests |
| `terrain-files.ts` | `server-only` loader for block types, the manifest, terrains and surroundings, plus the dev write transaction with rollback and terrain delete (which refuses the root) |
| `editor-store.ts`, `editor/{api,selectors,terrain-ops}.ts` | Session-only Zustand store; fetch layer for `/api/editor/*`; dirty/status selectors; pure transforms |
| `content.ts` | Server-only (`node:fs`) MDX loaders (`loadPanel`, `loadList`, `loadListItem`), `fm*` frontmatter narrowers, and `parseInline`/`markdownToBlocks` for XR |
| `use-counter-value.ts` | `useCounterValue(endpoint)`: fetches JSON `{ count }` once per page load per URL (module-cached promise); `null` on failure |
| `surroundings/` | Generator + `GeneratedSurroundings` type (`MapData.surroundings` depends on it) |
| `xr-store.ts` | Shared XR store (dynamic-import only) |
| `radial-reveal.ts`, `theme-colors.ts`, `theme-transition.ts`, `map-element-appearance.ts`, `perf-flag.ts` | Reveal constants/state, `ThemeColorPair` helpers, frame-rate-independent theme blending, default element colors, perf flag |

## Terrain JSON rules (enforced by `lib/terrains/validation.ts`)

`loadMapData()` validates everything on every render of `/` and `/editor`. **Any violation throws and takes both pages down**, and every save re-validates the whole map.

**Manifest and block types**
- Both documents are `version: 2`.
- The manifest's `terrainIds` must be non-empty and contain `rootTerrainId`. Every listed id needs `data/terrains/<id>.json` whose `id` matches the file name.
- Block types must be non-empty, and `defaultBlockTypeId` must exist.
- Colors are `{ light, dark }` pairs of six-digit hex values; dark is required.

**Ids and grid**
- Terrain and block-type ids match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and a terrain can't be named `index`. An optional `atmosphere` must match the same pattern; unknown presets are allowed.
- Grid `width` and `depth` are integers from 1 to 200, and `originX`/`originZ` are finite.
- Layers have unique integer `y` values (negative is allowed) and a non-empty `masks` object.
- Each mask key is a known block type. A mask is exactly `depth` rows of exactly `width` `0`/`1` characters and contains at least one `1`.
- No two masks in a layer may overlap.

**Every element**
- A unique non-empty `id`.
- `type` is one of `title|caption|button|image|counter`.
- `position` is `[x, y, z]`.
- `orientation` (`"ground"|"upright"`) is **required**.
- `scale` > 0.
- Title, caption and button need a `text` string.

**Buttons**
- At most one of `targetTerrainId`/`contentSectionId`/`href`.
- `contentItemSlug` requires `contentSectionId`.
- `href` is `https:` (no credentials) or `mailto:`.
- `hoverCardItem` is `"<sectionId>/<itemSlug>"`: exactly one `/` with two non-empty parts.
- `contentMode` `image`/`captionImage` requires `image`.

**Images and counters**
- Image `src` (and counter `endpoint`) must be root-relative (not `//`) or `https:` without credentials.
- Image `width`/`height` are greater than 0 and at most 200.
- Counter `digits` is 1–12, and `value` is a non-negative safe integer.

**Not checked**
- References aren't cross-checked. A missing `targetTerrainId` silently no-ops, an unknown `contentSectionId` is ignored (`MenuShell.openSection` checks `overlays`), and an unknown `hoverCardItem` shows no card.
- Delete block types in the same change as the terrains that use them.

## Camera & world-space
- `MAP_CAMERA_FOV = 5` (reading mode also uses 5°), a very long lens that gives near-parallel edges.
- `BASE_OFFSET = (-4.3, 40.5, 34.7)` puts the camera south of the map with a 7° lean west at about 49° pitch. The distance is scaled per viewport by binary search against the active terrain's grid corners (inset) plus element bounds, with the height treated as `FIT_HEIGHT` = 3.
- **The Canvas initial `camera.position` in `VoxelMap.tsx` duplicates `BASE_OFFSET`; change both.**
- Three.js axes: **+X = east**, **-X = west**, **+Z = south** (toward the camera), **-Z = north**, +Y up.
- The demo root terrain `home` is a 57×41 grid at origin (-28, -20), so X ∈ [-28, 28] and Z ∈ [-20, 20]. It has a grass/sand layer at y = 0 over a dirt base at y = -1 (the water surface sits just below 0), plus a small tree built upward in the north-west corner. A second demo terrain, `dusk` (35×25, `"atmosphere": "dusk"`), is reached through the NEXT ISLAND button and ships with generated surroundings.
- Demo content: `sections` are `article` (panel, `content/article.mdx`) and `list` (list, `content/list/*.mdx`). Buttons are labelled after the feature they demonstrate (ARTICLE PANEL, LIST PANEL, HOVER ME → `hoverCardItem: "list/sample-item"`, NEXT ISLAND, EXTERNAL LINK). Demo images, the GIF and button icons are in `public/samples/`; README screenshots are in `docs/screenshots/`.
- Presentation modes (`AmbientCamera` `mode`):
  - `map`: the default framing.
  - `reading`: orbits to `READING_OFFSET` and reframes the island below the overlay panel, using the panel's bottom edge reported by `SectionOverlay`. `MenuShell` switches to `reading` while an overlay is open.

## Terrain grid coordinates
- `terrain.grid.layers[]`: each layer is one integer `y` level. Each block-type mask has one `0`/`1` string per Z row.
- Cell `(i, j)` in layer `y` → world `(originX + i, y, originZ + j)`.
- Painter top row = world `originZ` = north.

## Content system
- `kind: "panel"` → a single `content/<id>.mdx`. The frontmatter `title` becomes the heading, falling back to `label`.
- `kind: "list"` → the folder `content/<id>/*.mdx`, sorted newest first by `fmDate(date)`, which handles gray-matter's Date objects.
  - Items are grouped by `category`; items without one go to "Other", sorted last.
  - Other fields: `title`, `summary`, `tech[]`, `repo`, `demo`.
- `app/page.tsx` server-renders every section into `overlays` (React trees plus plain-data `reading` for XR).
- It also builds `hoverCards` keyed `"<sectionId>/<itemSlug>"` for **every** list section. `app/editor/page.tsx` must build the same keys for the picker; keep the two in sync.
- Empty states: a missing panel file or an empty list shows an "Add … to /content/…" hint instead of crashing.
- No per-item URLs exist. The overlay state lives only in `MenuShell` React state, and MDX links that don't start with `http` go through `next/link`.
- To add a section: add it to `sections[]`, create the file or folder, then set a button's `contentSectionId` in the editor.

## Reading surface (article theme)
- A section opens in `components/menu/SectionOverlay.tsx`: an animated mosaic-glass dialog over the upper viewport, with the island reframed below it. It handles Escape, Back, scroll lock, a focus trap and a floating title.
- Its styling comes from `article.config.ts` tokens, turned into `--article-*` variables by `ArticleThemeScope` and consumed by `app/article.css`.
- List items get an `ArticleMasthead` (eyebrow, title, lede, and `ProjectMeta` repo/demo/tech).
- The same glass is used by hover cards and the corner pills.
- Both light and dark variants are live.

## Performance
The scene is tuned to stay cheap; keep it that way:
- **Instancing**: terrain, voxel text and surroundings render through `InstancedVoxels` (one `InstancedMesh` per batch). Batch new cube-heavy features; don't map `<Voxel>`.
- **On-demand rendering**: see the first gotcha below.
- **Code splitting**: `XRLayer`, `XRArticlePanel`, `XRPackageHandles` and `EnterXRButton` are dynamic imports (`XRLayer` and the XR store still load on every visit, just outside the initial bundle). `PerfOverlay` is a static import that loads `r3f-perf` itself via a dynamic import, only when the perf flag is on.
- **Dev perf HUD**: `?perf` or `NEXT_PUBLIC_PERF=1` mounts r3f-perf (draw calls, triangles, fps).
- **Bundle treemap**: `ANALYZE=1 npm run build`.

## Gotchas that keep the scene correct
- **`frameloop="demand"`**: anything that mutates the scene must call `invalidate()` (from `useThree`), every frame until it settles if it animates, or it won't show. `AmbientCamera`, the reveal drivers, `SceneLights`/`MapKeyLight`/`WaterPlane` color lerps, `MapImagePlane` GIF frames and `InstancedVoxels` all do this. Data that arrives later (e.g. a counter's fetched value) must trigger a React re-render, not a ref mutation.
- **XR scale**: in a session the world is scaled by `groupScale` = 1.2 m ÷ the widest span of all terrains and their surroundings, which is a few centimetres per terrain unit.
  - Any light with distance falloff and any shadow camera must scale with it. `MapKeyLight` scales its shadow near/far/bias by `worldScale`. `VoxelNixieCounter` scales its point light's distance linearly and intensity quadratically, or it floods the island.
  - Pass `worldScale` through `TerrainElements`.
  - Shader parameters in metres or terrain units must survive the rig transform (compute them in island space, as `WaterPlane`'s AR ring does).
- Keep **`emulate: false`** in `createXRStore`, **`KickRender`** in `XRLayer`, and the always-mounted rig stack plus `RigTransformReset`.
- **MenuShell XR clear-section effect** (`if (inXR && !overlayOpen && active !== null) clearSection()`): in XR the DOM overlay is unmounted, so its `onExitComplete` never fires. Without the effect, closing the in-scene panel leaves every island button disabled.
- **`<ArticleMosaicFilter />` is mounted exactly once in `app/layout.tsx`.** Its `#article-mosaic` SVG filter is referenced by the article glass (`article.config.ts` `backdropFilter`), `.theme-switcher` and `.xr-pill`. If it's missing, Chromium drops the whole `backdrop-filter` and the glass disappears; if it's mounted twice, the ids collide.
- **Keep `import "./globals.css"` and `"./article.css"` in the root layout**: the overlay, hover cards and the editor preview all rely on `article.css`.
- **All six `next/font` families are used**:
  - Press Start 2P and VT323 feed `--font-block`, which the editor uses through Tailwind `font-block`.
  - Inter feeds `--font-body`.
  - Fira Sans, Fira Code and Fraunces are reached only through `article.config.ts` strings, so grep misses them.
- **`palette` must stay exported from `site.config.ts`** with its keys (`brown`, `brownDark`, `cream`, `charcoal`).
- **Generated surroundings bake in their palette**: change the atmosphere or the generator palette, then regenerate.
- **Hover-card exit** is tied to the `article-glass-disperse` keyframe name in `app/article.css`. If you rename it, cards fall back to the timeout path.
- `app/editor/page.tsx` is `force-dynamic` so it rereads `data/` after saves. Keep it.
- `lib/content.ts` and `lib/terrain-files.ts` are server-only. Import them only from server components or route handlers.
- `XRSessionMode` is a global type from `@types/webxr`, which comes in transitively through `@types/three`.
- `tsconfig.json` includes `.next/types/**`. After deleting routes, remove `.next/` before `npm run typecheck`.
- `eslint.config.mjs` names `components/editor/**`, `components/map/**` and `components/menu/SectionOverlay.tsx` in a react-hooks override. Update it if those files move.

## Commands
`npm run dev` · `npm run dev:https` (headset testing) · `npm run build` · `npm start` · `npm run lint` · `npm run typecheck`
