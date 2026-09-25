"use client";

import dynamic from "next/dynamic";

/**
 * Draw-call / triangle / fps HUD for the R3F scene. Rendered INSIDE <Canvas>.
 *
 * r3f-perf is pulled via a dynamic import so its code lands in a separate async
 * chunk that is only fetched when the perf flag is on (see lib/perf-flag.ts) —
 * it never bloats the production bundle.
 */
const Perf = dynamic(() => import("r3f-perf").then((m) => m.Perf), {
  ssr: false,
  loading: () => null,
});

export function PerfOverlay() {
  return <Perf position="top-left" />;
}
