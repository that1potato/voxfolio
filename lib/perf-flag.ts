/**
 * Dev-only performance overlay gate.
 *
 * Enable by running with NEXT_PUBLIC_PERF=1, or append ?perf to any URL
 * (e.g. localhost:3000/?perf). The r3f-perf overlay is dynamically imported
 * behind this flag, so it never ships in the production bundle.
 */
export const perfEnabled =
  process.env.NEXT_PUBLIC_PERF === "1" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("perf"));
