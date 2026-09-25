"use client";

import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import type { ParsedFrame } from "gifuct-js";
import type { ElementOrientation, SurfaceFace } from "@/lib/terrains";
import { getSurfacePlaneRotation } from "./element-layout";

interface LoadedTexture {
  texture: Texture;
  aspectRatio: number;
  gif?: GifPlayback;
}

interface GifPlayback {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  patchCanvas: HTMLCanvasElement;
  patchContext: CanvasRenderingContext2D;
  frames: ParsedFrame[];
  frameIndex: number;
  restoreImageData: ImageData | null;
}

interface Props {
  src: string;
  alt: string;
  position?: [number, number, number];
  rotationY?: number;
  orientation: ElementOrientation;
  surfaceFace?: SurfaceFace;
  scale?: number;
  width?: number;
  height?: number;
  maxSize?: number;
  opacity?: number;
  renderOrder?: number;
}

export function isAnimatedImageSource(src: string): boolean {
  try {
    return new URL(src, "https://map.local").pathname.toLowerCase().endsWith(".gif");
  } catch {
    return false;
  }
}

function getImageAspectRatio(texture: Texture): number {
  const image = texture.image as
    | { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
    | undefined;
  const width = image?.naturalWidth ?? image?.width ?? 1;
  const height = image?.naturalHeight ?? image?.height ?? 1;
  return width > 0 && height > 0 ? width / height : 1;
}

function frameDelay(frame: ParsedFrame): number {
  return Math.max(20, frame.delay || 100);
}

function drawGifPatch(playback: GifPlayback, frame: ParsedFrame) {
  const { dims } = frame;
  const { patchCanvas, patchContext } = playback;

  if (patchCanvas.width !== dims.width || patchCanvas.height !== dims.height) {
    patchCanvas.width = dims.width;
    patchCanvas.height = dims.height;
  }

  const imageData = patchContext.createImageData(dims.width, dims.height);
  imageData.data.set(frame.patch);
  patchContext.putImageData(imageData, 0, 0);
  playback.context.drawImage(patchCanvas, dims.left, dims.top);
}

function drawGifFrame(playback: GifPlayback, frameIndex: number) {
  const frame = playback.frames[frameIndex];
  if (!frame) return;

  if (frame.disposalType === 3) {
    playback.restoreImageData = playback.context.getImageData(
      0,
      0,
      playback.canvas.width,
      playback.canvas.height,
    );
  } else {
    playback.restoreImageData = null;
  }

  drawGifPatch(playback, frame);
  playback.frameIndex = frameIndex;
}

function advanceGifFrame(playback: GifPlayback) {
  const currentFrame = playback.frames[playback.frameIndex];
  if (!currentFrame) return;

  if (currentFrame.disposalType === 2) {
    const { dims } = currentFrame;
    playback.context.clearRect(dims.left, dims.top, dims.width, dims.height);
  } else if (currentFrame.disposalType === 3 && playback.restoreImageData) {
    playback.context.putImageData(playback.restoreImageData, 0, 0);
  }

  const nextFrameIndex = (playback.frameIndex + 1) % playback.frames.length;
  if (nextFrameIndex === 0) {
    playback.context.clearRect(0, 0, playback.canvas.width, playback.canvas.height);
  }
  drawGifFrame(playback, nextFrameIndex);
}

async function loadGifTexture(
  src: string,
  signal: AbortSignal,
): Promise<LoadedTexture> {
  const response = await fetch(src, { mode: "cors", signal });
  if (!response.ok) {
    throw new Error(`Failed to load GIF: ${response.status}`);
  }

  const [{ parseGIF, decompressFrames }, arrayBuffer] = await Promise.all([
    import("gifuct-js"),
    response.arrayBuffer(),
  ]);
  const gif = parseGIF(arrayBuffer);
  const frames = decompressFrames(gif, true);
  if (frames.length === 0 || gif.lsd.width <= 0 || gif.lsd.height <= 0) {
    throw new Error("GIF has no decodable frames");
  }

  const canvas = document.createElement("canvas");
  canvas.width = gif.lsd.width;
  canvas.height = gif.lsd.height;
  const context = canvas.getContext("2d");
  const patchCanvas = document.createElement("canvas");
  const patchContext = patchCanvas.getContext("2d");
  if (!context || !patchContext) {
    throw new Error("Canvas 2D is unavailable");
  }

  const playback: GifPlayback = {
    canvas,
    context,
    patchCanvas,
    patchContext,
    frames,
    frameIndex: 0,
    restoreImageData: null,
  };
  drawGifFrame(playback, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    aspectRatio: gif.lsd.width / gif.lsd.height,
    gif: playback,
  };
}

export function MapImagePlane({
  src,
  alt,
  position = [0, 0, 0],
  rotationY = 0,
  orientation,
  surfaceFace,
  scale = 1,
  width = 1,
  height = 1,
  maxSize,
  opacity = 1,
  renderOrder = 2,
}: Props) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const [loaded, setLoaded] = useState<LoadedTexture | null>(null);
  const [failed, setFailed] = useState(false);
  const animated = isAnimatedImageSource(src);

  useEffect(() => {
    if (!src) {
      setLoaded(null);
      setFailed(true);
      invalidate();
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    let textureToDispose: Texture | null = null;
    setLoaded(null);
    setFailed(false);

    if (animated) {
      void loadGifTexture(src, abortController.signal)
        .then((nextLoaded) => {
          textureToDispose = nextLoaded.texture;
          if (cancelled) {
            nextLoaded.texture.dispose();
            return;
          }
          nextLoaded.texture.anisotropy = Math.min(
            8,
            gl.capabilities.getMaxAnisotropy(),
          );
          setLoaded(nextLoaded);
          invalidate();
        })
        .catch((error: unknown) => {
          if (cancelled || abortController.signal.aborted) return;
          console.error(`Unable to load animated map image "${src}"`, error);
          setFailed(true);
          invalidate();
        });
    } else {
      const loader = new TextureLoader();
      loader.setCrossOrigin("anonymous");
      textureToDispose = loader.load(
        src,
        (nextTexture) => {
          if (cancelled) {
            nextTexture.dispose();
            return;
          }
          nextTexture.colorSpace = SRGBColorSpace;
          nextTexture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
          nextTexture.needsUpdate = true;
          setLoaded({
            texture: nextTexture,
            aspectRatio: getImageAspectRatio(nextTexture),
          });
          invalidate();
        },
        undefined,
        () => {
          if (cancelled) return;
          setFailed(true);
          invalidate();
        },
      );
    }

    return () => {
      cancelled = true;
      abortController.abort();
      textureToDispose?.dispose();
    };
  }, [animated, gl, invalidate, src]);

  useEffect(() => {
    const playback = loaded?.gif;
    if (!animated || !loaded || !playback) return;

    let timeoutId: number | undefined;

    const scheduleNextFrame = () => {
      window.clearTimeout(timeoutId);
      if (document.hidden) return;

      const delay = frameDelay(playback.frames[playback.frameIndex]);
      timeoutId = window.setTimeout(() => {
        advanceGifFrame(playback);
        loaded.texture.needsUpdate = true;
        invalidate();
        scheduleNextFrame();
      }, delay);
    };

    const handleVisibilityChange = () => scheduleNextFrame();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleNextFrame();

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [animated, invalidate, loaded]);

  const dimensions = useMemo(() => {
    if (maxSize === undefined) return { width, height };
    const aspectRatio = loaded?.aspectRatio ?? 1;
    return aspectRatio >= 1
      ? { width: maxSize, height: maxSize / aspectRatio }
      : { width: maxSize * aspectRatio, height: maxSize };
  }, [height, loaded?.aspectRatio, maxSize, width]);

  const planeRotation: [number, number, number] = surfaceFace
    ? getSurfacePlaneRotation(surfaceFace)
    : orientation === "ground"
      ? [-Math.PI / 2, 0, 0]
      : [0, 0, 0];

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
      userData={{ alt, imageSource: src }}
    >
      <mesh
        rotation={planeRotation}
        renderOrder={renderOrder}
        castShadow={!!loaded}
        receiveShadow={!!loaded}
      >
        <planeGeometry args={[dimensions.width, dimensions.height]} />
        {loaded ? (
          <meshStandardMaterial
            map={loaded.texture}
            color="#ffffff"
            roughness={1}
            metalness={0}
            transparent
            opacity={opacity}
            alphaTest={0.05}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
            side={DoubleSide}
          />
        ) : (
          <meshBasicMaterial
            color={failed ? "#9f2d2d" : "#6b5a4f"}
            transparent
            opacity={Math.max(0.25, opacity * 0.7)}
            wireframe
            side={DoubleSide}
            toneMapped={false}
          />
        )}
      </mesh>
    </group>
  );
}
