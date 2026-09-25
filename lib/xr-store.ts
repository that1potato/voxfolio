"use client";

import { createXRStore } from "@react-three/xr";

/**
 * The single shared WebXR store. Created at module scope so the "View in your
 * space" button and the in-Canvas <XR> wrapper drive the *same* session.
 *
 * Importing this module pulls in `@react-three/xr`, so it must only ever be
 * reached through a dynamic boundary — EnterXRButton imports it inside its
 * probe/click handlers, and XRLayer is itself loaded via next/dynamic. Nothing
 * on the always-loaded path may import it, or the XR bundle would ship to every
 * visitor.
 *
 * To test on localhost without a headset, use the Immersive Web Emulator
 * browser extension (it injects `navigator.xr` at the browser level). We
 * deliberately disable @react-three/xr's *built-in* `emulate`: its iwer runtime
 * (@iwer/devui, @iwer/sem) bundles its own three@0.165, which loads a second
 * Three.js instance and breaks rendering. The extension has no such conflict.
 */
export const xrStore = createXRStore({
  // Entry is driven solely by our button; suppress the browser's auto-offered
  // session UI so behaviour is deterministic and gated by our capability probe.
  offerSession: false,
  // See above — the in-bundle emulator pulls a conflicting Three.js copy.
  emulate: false,
  // ── Render quality (tune-on-device knobs) ─────────────────────────────────
  // Devices default to a low framebuffer scale (~1.0) with aggressive fixed
  // foveation, which reads as blurry. The scene is fully instanced and cheap,
  // so request the device max and no foveation; if frame rate dips on-device,
  // drop to e.g. `(max) => Math.min(max, 1.5)` / `foveation: 0.5`.
  frameBufferScaling: "high",
  foveation: 0,
  frameRate: "high",
});

/**
 * Enter immersive XR, preferring Quest-style passthrough AR and falling back to
 * an immersive-VR void (e.g. Vision Pro Safari, which exposes VR but not AR to
 * WebXR today). Returns once the session request resolves.
 */
export async function enterXRPreferAR(): Promise<void> {
  const xr = typeof navigator !== "undefined" ? navigator.xr : undefined;
  if (!xr) return;
  try {
    if (await xr.isSessionSupported("immersive-ar")) {
      await xrStore.enterAR();
      return;
    }
  } catch {
    // AR probe threw — fall through and try VR.
  }
  try {
    if (await xr.isSessionSupported("immersive-vr")) {
      await xrStore.enterVR();
    }
  } catch {
    // No supported immersive session; the button should not have rendered.
  }
}

/** True when the device can start either an immersive-ar or immersive-vr session. */
export async function xrSupported(): Promise<boolean> {
  const xr = typeof navigator !== "undefined" ? navigator.xr : undefined;
  if (!xr) return false;
  try {
    if (await xr.isSessionSupported("immersive-ar")) return true;
  } catch {
    // ignore and try VR
  }
  try {
    return await xr.isSessionSupported("immersive-vr");
  } catch {
    return false;
  }
}
