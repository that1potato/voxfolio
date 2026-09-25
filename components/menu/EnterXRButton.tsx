"use client";

import { useEffect, useState } from "react";

/**
 * "View in your space" pill, shown beside the theme switcher. Renders nothing
 * until we confirm the device can actually start an immersive session, so
 * desktop visitors never see it.
 *
 * All `@react-three/xr` code (the store) is reached via dynamic import(), so it
 * stays out of the initial bundle and loads in its own async chunk after the
 * page renders.
 */
export function EnterXRButton({ hidden }: { hidden?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [inSession, setInSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      const mod = await import("@/lib/xr-store");
      // A real headset exposes navigator.xr at page load, but the localhost
      // emulator injects it a beat after the store is created — poll briefly so
      // the button appears in both cases without harming the real-device path.
      let ok = false;
      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
        ok = await mod.xrSupported();
        if (ok || cancelled) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (cancelled) return;
      setSupported(ok);
      if (!ok) return;
      setInSession(mod.xrStore.getState().session != null);
      unsubscribe = mod.xrStore.subscribe((state) => {
        if (!cancelled) setInSession(state.session != null);
      });
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  if (!supported) return null;

  const handleClick = async () => {
    const mod = await import("@/lib/xr-store");
    const current = mod.xrStore.getState().session;
    if (current) {
      await current.end();
    } else {
      await mod.enterXRPreferAR();
    }
  };

  return (
    <button
      type="button"
      className={`xr-pill${hidden ? " xr-pill--hidden" : ""}`}
      onClick={handleClick}
      aria-label={inSession ? "Exit immersive mode" : "View in your space"}
    >
      <HeadsetIcon className="xr-pill__icon" />
      <span className="xr-pill__label">
        {inSession ? "Exit" : "View in your space"}
      </span>
    </button>
  );
}

function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 8.5C3 7.12 4.12 6 5.5 6h13C19.88 6 21 7.12 21 8.5v5c0 1.38-1.12 2.5-2.5 2.5h-3.18c-.59 0-1.14-.31-1.45-.81l-.87-1.4c-.23-.37-.77-.37-1 0l-.87 1.4c-.31.5-.86.81-1.45.81H5.5A2.5 2.5 0 0 1 3 13.5v-5z" />
    </svg>
  );
}
