"use client";

import { useEffect, useState } from "react";

// Fetches a counter element's `endpoint` at most once per page load per URL.
// A module-level promise cache is shared across every caller so two counters
// (or a remount) pointing at the same endpoint never double-fetch — which
// matters when the endpoint increments on each request (e.g. a visitor count).
//
// The endpoint must answer with JSON `{ "count": number }`. Any failure
// resolves to null, and the counter keeps showing its static `value`.

const cache = new Map<string, Promise<number | null>>();

function fetchCount(endpoint: string): Promise<number | null> {
  let promise = cache.get(endpoint);
  if (!promise) {
    promise = fetch(endpoint, { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) =>
        data && typeof data.count === "number" && Number.isFinite(data.count)
          ? (data.count as number)
          : null,
      )
      .catch(() => null);
    cache.set(endpoint, promise);
  }
  return promise;
}

export function useCounterValue(endpoint?: string | null): number | null {
  // Remember which endpoint the count belongs to, so a changed endpoint never
  // shows the previous endpoint's number while its own fetch is in flight.
  const [result, setResult] = useState<{
    endpoint: string;
    count: number | null;
  } | null>(null);

  useEffect(() => {
    if (!endpoint) return;
    let active = true;
    fetchCount(endpoint).then((count) => {
      if (active) setResult({ endpoint, count });
    });
    return () => {
      active = false;
    };
  }, [endpoint]);

  return endpoint && result?.endpoint === endpoint ? result.count : null;
}
