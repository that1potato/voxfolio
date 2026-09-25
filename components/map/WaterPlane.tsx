"use client";

import { useMemo, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { terrainCenter } from "@/lib/terrains";
import type { Terrain, TerrainGrid } from "@/lib/terrains";
import type { SiteThemeMode } from "@/theme.config";
import type { GeneratedSurroundings } from "@/lib/surroundings/types";
import { advanceBlend, THEME_BLEND } from "@/lib/theme-transition";
import type { RadialRevealMask } from "@/lib/radial-reveal";
import { waterColorsFor } from "./water.config";

interface Props {
  terrain: Terrain;
  /** Surroundings are used to widen the land-distance field; absent on first load. */
  surroundings?: GeneratedSurroundings | null;
  themeMode: SiteThemeMode;
  radialReveal?: RadialRevealMask;
  /**
   * Passthrough-AR mode: instead of the endless horizon plane, keep only a
   * padded ring of water around the land footprint and fade its outer edge to
   * fully transparent, so the water dissolves into the real room.
   */
  boundedEdge?: boolean;
}

// Large enough to fill the viewport at any camera distance.
const PLANE_SIZE = 4000;

// World-distance band (units from the island center) over which the water
// fades into the sky, dissolving the hard horizon seam. Keyed off world
// distance — not camera distance — because the telephoto map camera sits far
// back, so a camera-distance threshold would fade the near water too. The
// island + surroundings span only ~±65 units from center, so FADE_START keeps
// the whole visible water ring opaque while only the far expanse dissolves.
const HORIZON_FADE_START = 150;
const HORIZON_FADE_END = 650;
const WATER_Y = -0.7;

// Bounded-edge (AR) fade band: an opaque water pad extends EDGE_FADE_START
// units past the outermost land bounds, then alpha falls to zero by
// EDGE_FADE_END (rounded-box distance). At the 1.2m tabletop, one unit is
// ~1.3cm, so the visible ring is ~8cm of water plus a ~16cm dissolve.
const EDGE_FADE_START = 6;
const EDGE_FADE_END = 18;

// Distance from land (in world units) beyond which the grid is completely invisible.
const GRID_FADE_FAR = 22;
// Max foam half-width (per-cell jitter can produce up to 1.6× this value).
const FOAM_WIDTH = 1.4;
// Extra padding added to the distance-field region beyond the island bounds.
const FIELD_PAD = 24;

// ---------------------------------------------------------------------------
// Ripple normal map (static, built once)
// ---------------------------------------------------------------------------

function buildRippleNormalMap() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  function hash(x: number, y: number) {
    let h = (Math.sin(x * 127.1 + y * 311.7) * 43758.545) % 1;
    if (h < 0) h += 1;
    return h;
  }
  function sn(x: number, y: number) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return (
      hash(ix,   iy)   * (1 - ux) * (1 - uy) +
      hash(ix+1, iy)   * ux       * (1 - uy) +
      hash(ix,   iy+1) * (1 - ux) * uy       +
      hash(ix+1, iy+1) * ux       * uy
    );
  }
  function fbm(x: number, y: number) {
    return sn(x*2, y*2)*0.55 + sn(x*4, y*4)*0.28 + sn(x*8, y*8)*0.12 + sn(x*16, y*16)*0.05;
  }

  const eps = 1 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size, v = py / size;
      const h  = fbm(u,       v);
      const hx = fbm(u + eps, v);
      const hy = fbm(u,       v + eps);
      const str = 2.5;
      const nx = (h - hx) * str, ny = (h - hy) * str, nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      const idx = (py * size + px) * 4;
      d[idx]   = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      d[idx+1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      d[idx+2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      d[idx+3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // 250 tiles across the 4000-unit plane ≈ one normal-map ripple per 16 units.
  tex.repeat.set(250, 250);
  return tex;
}

// ---------------------------------------------------------------------------
// Land-distance DataTexture
// ---------------------------------------------------------------------------

interface DistField {
  tex: THREE.DataTexture;
  fieldMinX: number;
  fieldMinZ: number;
  fieldW: number;
  fieldH: number;
}

const landDistFieldCache = new Map<string, DistField>();
let rippleNormalMapCache: THREE.CanvasTexture | null = null;

function gridCacheKey(grid: TerrainGrid): string {
  const layers = grid.layers
    .map((layer) => {
      const masks = Object.entries(layer.masks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([blockTypeId, rows]) => `${blockTypeId}:${rows.join("/")}`)
        .join("|");
      return `${layer.y}:${masks}`;
    })
    .join(";");
  return `${grid.originX},${grid.originZ},${grid.width},${grid.depth}:${layers}`;
}

function landDistFieldCacheKey(
  terrain: Terrain,
  surroundings?: GeneratedSurroundings | null,
): string {
  return [
    terrain.id,
    gridCacheKey(terrain.grid),
    surroundings ? gridCacheKey(surroundings.grid) : "no-surroundings",
  ].join("::");
}

function getRippleNormalMap() {
  if (!rippleNormalMapCache) rippleNormalMapCache = buildRippleNormalMap();
  return rippleNormalMapCache;
}

function getLandDistField(
  terrain: Terrain,
  surroundings?: GeneratedSurroundings | null,
) {
  const key = landDistFieldCacheKey(terrain, surroundings);
  const cached = landDistFieldCache.get(key);
  if (cached) return cached;
  const field = buildLandDistField(terrain, surroundings);
  landDistFieldCache.set(key, field);
  return field;
}

export function prewarmWaterResources(
  terrain: Terrain,
  surroundings?: GeneratedSurroundings | null,
) {
  if (typeof document === "undefined") return;
  getRippleNormalMap();
  getLandDistField(terrain, surroundings);
}

/**
 * Multi-source BFS distance transform: finds, for every cell in the field
 * region, the world-unit distance to the nearest above-water land block
 * (y >= 0 in either the authored terrain or the surroundings). Returns a
 * normalized [0,1] DataTexture capped at GRID_FADE_FAR.
 *
 * Land cells → dist=0; seabed/pond cells (y<0 only) and empty cells → dist>0.
 * This means foam and grid lines form around the outer coast AND interior ponds.
 */
function buildLandDistField(
  terrain: Terrain,
  surroundings?: GeneratedSurroundings | null,
): DistField {
  const refGrid: TerrainGrid = surroundings?.grid ?? terrain.grid;
  const fieldMinX = refGrid.originX - FIELD_PAD;
  const fieldMinZ = refGrid.originZ - FIELD_PAD;
  const fieldW = refGrid.width  + FIELD_PAD * 2;
  const fieldH = refGrid.depth  + FIELD_PAD * 2;

  const BFS_CAP = GRID_FADE_FAR + 2; // small overshoot for smooth edge

  // Collect all above-water land positions.
  const isLand = new Set<string>();

  function markGrid(g: TerrainGrid) {
    for (const layer of g.layers) {
      if (layer.y < 0) continue; // seabed / pond — not land
      for (const rows of Object.values(layer.masks)) {
        for (let j = 0; j < rows.length; j++) {
          const row = rows[j];
          for (let i = 0; i < row.length; i++) {
            if (row[i] === "1") isLand.add(`${g.originX + i},${g.originZ + j}`);
          }
        }
      }
    }
  }

  markGrid(terrain.grid);
  if (surroundings) markGrid(surroundings.grid);

  // BFS over the field region, seeded from land cells.
  const dist = new Float32Array(fieldW * fieldH).fill(BFS_CAP + 1);
  const queue: number[] = [];
  let head = 0;

  for (let j = 0; j < fieldH; j++) {
    for (let i = 0; i < fieldW; i++) {
      if (isLand.has(`${fieldMinX + i},${fieldMinZ + j}`)) {
        dist[j * fieldW + i] = 0;
        queue.push(j * fieldW + i);
      }
    }
  }

  while (head < queue.length) {
    const idx = queue[head++];
    const ci = idx % fieldW;
    const cj = (idx / fieldW) | 0;
    const cd = dist[idx];
    if (cd >= BFS_CAP) continue;
    for (const [di, dj] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || ni >= fieldW || nj < 0 || nj >= fieldH) continue;
      const nidx = nj * fieldW + ni;
      if (dist[nidx] > cd + 1) {
        dist[nidx] = cd + 1;
        queue.push(nidx);
      }
    }
  }

  // Pack into a single-channel byte texture (R channel).
  const data = new Uint8Array(fieldW * fieldH);
  for (let k = 0; k < data.length; k++) {
    data[k] = Math.round(Math.min(dist[k] / GRID_FADE_FAR, 1) * 255);
  }

  const tex = new THREE.DataTexture(data, fieldW, fieldH, THREE.RedFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  return { tex, fieldMinX, fieldMinZ, fieldW, fieldH };
}

// ---------------------------------------------------------------------------
// Shader injection strings
// ---------------------------------------------------------------------------

const VERT_PREAMBLE = `varying vec2 vIslandXZ;\nuniform vec2 uPlaneCenter;\n`;

// Island-space XZ from object-space position: the plane is centered on the
// island and rotated -PI/2 about X, so local (x, y) maps to island (x, -y)
// offsets from the center. Object space is immune to ancestor transforms —
// the XR tabletop rig scales/moves/yaws the world, so a modelMatrix-derived
// world position would no longer line up with the terrain-unit uniforms
// (grid pitch, distance field, reveal origin, fade distances).
const VERT_INJECT = `vIslandXZ = uPlaneCenter + vec2(position.x, -position.y);\n`;

const FRAG_PREAMBLE = `
varying vec2 vIslandXZ;
uniform sampler2D uLandDist;
uniform vec2  uFieldMin;
uniform vec2  uFieldSize;
uniform vec2  uCenter;
uniform vec3  uBaseColor;
uniform vec3  uFoamColor;
uniform vec3  uHorizonColor;
uniform float uGridFadeFar;
uniform float uFoamWidth;
uniform float uHorizonFadeStart;
uniform float uHorizonFadeEnd;
uniform float uRevealEnabled;
uniform float uRevealMode;
uniform float uRevealRadius;
uniform vec2  uRevealOrigin;
uniform float uEdgeEnabled;
uniform vec2  uEdgeCenter;
uniform vec2  uEdgeHalf;
uniform float uEdgeFadeStart;
uniform float uEdgeFadeEnd;

// Value-noise helpers — declared here (outside main) so they are valid GLSL.
float _wH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float _wN(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(_wH(i), _wH(i+vec2(1,0)), u.x), mix(_wH(i+vec2(0,1)), _wH(i+vec2(1,1)), u.x), u.y);
}
float _wFbm(vec2 p) {
  return _wN(p)*0.55 + _wN(p*2.1)*0.28 + _wN(p*4.3)*0.12 + _wN(p*8.7)*0.05;
}
`;

// Replaces #include <map_fragment>. All local names are prefixed _w to avoid
// collisions with Three.js's standard uniform/varying names.
const FRAG_COLOR = `
// ---- water surface color ---------------------------------------------------
if (uRevealEnabled > 0.5) {
  vec2 _wRevealCell = floor(vIslandXZ) + vec2(0.5);
  bool _wRevealInside = length(_wRevealCell - uRevealOrigin) <= uRevealRadius;
  if ((uRevealMode < 0.5 && !_wRevealInside) || (uRevealMode > 0.5 && _wRevealInside)) {
    discard;
  }
}

// Sample the land-distance field.
vec2  _wUV    = clamp((vIslandXZ - uFieldMin) / uFieldSize, 0.0, 1.0);
float _wD01   = texture2D(uLandDist, _wUV).r;  // 0 = at land, 1 = far
float _wDistW = _wD01 * uGridFadeFar;           // world-unit distance to land

// Thin white 1-unit grid — noise modulates intensity so lines vary organically.
vec2  _wGF      = abs(fract(vIslandXZ + 0.5) - 0.5); // 0.5 at border, 0 at centre
float _wLine    = step(0.475, max(_wGF.x, _wGF.y)); // ~2.5% border = thin lines
float _wNoise   = _wFbm(vIslandXZ * 0.22);           // low-freq envelope
float _wDistFd  = 1.0 - smoothstep(0.0, 0.82, _wD01);
float _wGrid    = _wLine * _wNoise * _wDistFd * 0.55;

// Per-cell ragged foam ring near shore.
vec2  _wFC    = floor(vIslandXZ);
float _wFR    = fract(sin(dot(_wFC, vec2(127.1, 311.7))) * 43758.5453);
float _wFT    = uFoamWidth * (0.45 + 1.1 * _wFR);
float _wFoam  = step(0.01, _wDistW) * step(_wDistW, _wFT);

// Compose — grid and foam both use the foam (white) color.
vec3 _wCol = uBaseColor;
_wCol = mix(_wCol, uFoamColor, _wGrid);
_wCol = mix(_wCol, uFoamColor, _wFoam);

// Dissolve the far water into the sky to hide the flat-plane horizon seam.
// Keyed on island-space distance from the island center (camera-independent).
float _wFar = smoothstep(uHorizonFadeStart, uHorizonFadeEnd, length(vIslandXZ - uCenter));
_wCol = mix(_wCol, uHorizonColor, _wFar);
diffuseColor = vec4(_wCol, diffuseColor.a * (1.0 - _wFar));

// Bounded edge (passthrough AR): rounded-box distance past the land footprint
// drives an alpha-only fade — there is no sky color to dissolve into, the
// water ring simply becomes transparent over the real room.
if (uEdgeEnabled > 0.5) {
  vec2  _wEB = abs(vIslandXZ - uEdgeCenter) - uEdgeHalf;
  float _wED = length(max(_wEB, vec2(0.0)));
  diffuseColor.a *= 1.0 - smoothstep(uEdgeFadeStart, uEdgeFadeEnd, _wED);
}
// ---- end water surface color -----------------------------------------------
`;

// ---------------------------------------------------------------------------
// Scratch colors for per-frame water lerp (avoids GC pressure).
// ---------------------------------------------------------------------------
const _wBase0 = new THREE.Color();
const _wBase1 = new THREE.Color();
const _wFoam0 = new THREE.Color();
const _wFoam1 = new THREE.Color();
const _wHorizon0 = new THREE.Color();
const _wHorizon1 = new THREE.Color();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WaterPlane({
  terrain,
  surroundings,
  themeMode,
  radialReveal,
  boundedEdge = false,
}: Props) {
  const invalidate = useThree((s) => s.invalidate);

  // Blend scalar: 0 = light, 1 = dark. Seed to the current mode so no fade on mount.
  const blend = useRef({ value: THEME_BLEND[themeMode] });
  const prevMode = useRef<SiteThemeMode>(themeMode);

  // Normal map — static, built once per mount.
  const normalMap = useMemo(() => getRippleNormalMap(), []);

  // Land-distance field — rebuilt when terrain/surroundings change.
  const distField = useMemo(
    () => getLandDistField(terrain, surroundings),
    [terrain, surroundings],
  );

  // Land-footprint box (island units) the bounded edge pads around — the same
  // outermost grid buildLandDistField treats as potentially-land.
  const edgeBox = useMemo(() => {
    const g = surroundings?.grid ?? terrain.grid;
    return {
      cx: g.originX + (g.width - 1) / 2,
      cz: g.originZ + (g.depth - 1) / 2,
      halfX: g.width / 2,
      halfZ: g.depth / 2,
    };
  }, [terrain, surroundings]);

  // Stable uniform object — values are mutated in place so the shader program
  // never needs to be recompiled when colors or the distance field change.
  // Seeded with the current-mode colors so there's no flash on first render.
  const initColors = waterColorsFor(terrain.atmosphere, themeMode);
  const uniforms = useMemo(() => ({
    uLandDist:    { value: distField.tex },
    uFieldMin:    { value: new THREE.Vector2(distField.fieldMinX, distField.fieldMinZ) },
    uFieldSize:   { value: new THREE.Vector2(distField.fieldW, distField.fieldH) },
    uCenter:      { value: new THREE.Vector2(...terrainCenter(terrain.grid)) },
    uBaseColor:    { value: new THREE.Color(initColors.base) },
    uFoamColor:    { value: new THREE.Color(initColors.foam) },
    uHorizonColor: { value: new THREE.Color(initColors.horizon) },
    uGridFadeFar:  { value: GRID_FADE_FAR },
    uFoamWidth:    { value: FOAM_WIDTH },
    uHorizonFadeStart: { value: HORIZON_FADE_START },
    uHorizonFadeEnd:   { value: HORIZON_FADE_END },
    uRevealEnabled: { value: 0 },
    uRevealMode:    { value: 0 },
    uRevealOrigin:  { value: new THREE.Vector2() },
    uRevealRadius:  { value: 0 },
    uPlaneCenter:   { value: new THREE.Vector2(...terrainCenter(terrain.grid)) },
    uEdgeEnabled:   { value: 0 },
    uEdgeCenter:    { value: new THREE.Vector2() },
    uEdgeHalf:      { value: new THREE.Vector2() },
    uEdgeFadeStart: { value: EDGE_FADE_START },
    uEdgeFadeEnd:   { value: EDGE_FADE_END },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wake the render loop when themeMode changes so the useFrame lerp can run.
  useEffect(() => {
    if (prevMode.current !== themeMode) {
      prevMode.current = themeMode;
      invalidate();
    }
  }, [themeMode, invalidate]);

  // Smoothly lerp water colors toward the target mode each frame.
  useFrame((_, delta) => {
    if (radialReveal) {
      const reveal = radialReveal.state.current;
      uniforms.uRevealEnabled.value = reveal.active ? 1 : 0;
      uniforms.uRevealMode.value = radialReveal.mode === "inside" ? 0 : 1;
      uniforms.uRevealOrigin.value.set(reveal.origin[0], reveal.origin[2]);
      uniforms.uRevealRadius.value = reveal.radius;
    } else {
      uniforms.uRevealEnabled.value = 0;
    }

    const target = THEME_BLEND[themeMode];
    const settled = advanceBlend(blend.current, target, delta);
    const t = blend.current.value;

    const L = waterColorsFor(terrain.atmosphere, "light");
    const D = waterColorsFor(terrain.atmosphere, "dark");

    _wBase0.set(L.base);
    _wBase1.set(D.base);
    uniforms.uBaseColor.value.lerpColors(_wBase0, _wBase1, t);

    _wFoam0.set(L.foam);
    _wFoam1.set(D.foam);
    uniforms.uFoamColor.value.lerpColors(_wFoam0, _wFoam1, t);

    _wHorizon0.set(L.horizon);
    _wHorizon1.set(D.horizon);
    uniforms.uHorizonColor.value.lerpColors(_wHorizon0, _wHorizon1, t);

    if (!settled) invalidate();
  });

  // Keep distance-field uniforms in sync when the island changes.
  useEffect(() => {
    uniforms.uLandDist.value = distField.tex;
    uniforms.uFieldMin.value.set(distField.fieldMinX, distField.fieldMinZ);
    uniforms.uFieldSize.value.set(distField.fieldW, distField.fieldH);
    const [ccx, ccz] = terrainCenter(terrain.grid);
    uniforms.uCenter.value.set(ccx, ccz);
    uniforms.uPlaneCenter.value.set(ccx, ccz);
    invalidate();
  }, [uniforms, distField, terrain, invalidate]);

  // Keep the bounded-edge uniforms in sync (uniform-driven — toggling AR
  // never recompiles the shader program).
  useEffect(() => {
    uniforms.uEdgeEnabled.value = boundedEdge ? 1 : 0;
    uniforms.uEdgeCenter.value.set(edgeBox.cx, edgeBox.cz);
    uniforms.uEdgeHalf.value.set(edgeBox.halfX, edgeBox.halfZ);
    invalidate();
  }, [uniforms, boundedEdge, edgeBox, invalidate]);

  // Material — created once with onBeforeCompile, never recreated.
  // The onBeforeCompile closure captures the stable `uniforms` object and
  // wires it into every compiled shader program automatically.
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    m.onBeforeCompile = (shader) => {
      // Wire the live-updatable uniforms into this program.
      Object.assign(shader.uniforms, uniforms);

      // Inject island-XZ varying into vertex shader.
      shader.vertexShader =
        VERT_PREAMBLE +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${VERT_INJECT}`,
        );

      // Replace the map_fragment chunk with our custom water color.
      shader.fragmentShader =
        FRAG_PREAMBLE +
        shader.fragmentShader.replace("#include <map_fragment>", FRAG_COLOR);
    };

    // Unique program cache key prevents this material sharing a compiled
    // shader with any standard MeshStandardMaterial.
    m.customProgramCacheKey = () => "water-v6-bounded-edge";

    return m;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Normal map is set on the material via ref (not a constructor arg) so it
  // doesn't trigger material recreation.
  const matRef = useRef(mat);
  useEffect(() => {
    const m = matRef.current;
    m.normalMap = normalMap;
    m.normalScale.set(0.35, 0.35);
    m.needsUpdate = true;
  }, [normalMap]);

  useEffect(() => () => { mat.dispose(); }, [mat]);

  const [cx, cz] = terrainCenter(terrain.grid);

  // With the bounded edge active, everything past EDGE_FADE_END is invisible —
  // shrink the plane to just cover the fade band instead of rasterizing the
  // full horizon quad (~80 room-metres across at tabletop scale) through the
  // user's room. The reach accounts for the land box sitting off the plane
  // center (the plane is centered on the terrain, the box on the surroundings).
  const planeSize = boundedEdge
    ? 2 *
      (Math.max(
        Math.abs(edgeBox.cx - cx) + edgeBox.halfX,
        Math.abs(edgeBox.cz - cz) + edgeBox.halfZ,
      ) +
        EDGE_FADE_END +
        2)
    : PLANE_SIZE;

  return (
    <mesh
      position={[cx, WATER_Y, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      receiveShadow
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
