"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { XR } from "@react-three/xr";
import { xrStore } from "@/lib/xr-store";
import { XRArticlePanel } from "./XRArticlePanel";
import type { ReadingContent } from "@/components/menu/overlay-types";
import { siteTheme, type SiteThemeMode } from "@/theme.config";

/**
 * Client half of the /dev/xr-panel harness (see app/dev/xr-panel/page.tsx):
 * the real XRArticlePanel at its real physical size in a plain Canvas, plus a
 * theme toggle. The <XR> wrapper is inert without a session but provides the
 * context the panel's composition layer needs — outside a session it renders
 * the render-target fallback, so the harness exercises the same texture
 * pipeline (and forwarded pointer events) the headset uses.
 * Never imported by production code paths.
 */
export function XRPanelPreview({ content }: { content: ReadingContent }) {
  const [mode, setMode] = useState<SiteThemeMode>(siteTheme.activeMode);
  const [isAR, setIsAR] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: mode === "dark" ? "#26221f" : "#b8c4c9",
      }}
    >
      <Canvas frameloop="always" camera={{ position: [0, 0, 0.55], fov: 60 }}>
        <XR store={xrStore}>
          <ambientLight intensity={1.2} />
          <XRArticlePanel
            content={content}
            themeMode={mode}
            isAR={isAR}
            position={[0, 0, 0]}
            width={0.7}
            height={0.7}
            onClose={() => console.log("close")}
            onBack={() => console.log("back")}
            onSelectItem={(slug) => console.log("select", slug)}
          />
          <OrbitControls enableDamping={false} />
        </XR>
      </Canvas>
      <div style={{ position: "fixed", top: 12, left: 12, display: "flex", gap: 8 }}>
        <button onClick={() => setMode(mode === "light" ? "dark" : "light")}>
          theme: {mode}
        </button>
        <button onClick={() => setIsAR(!isAR)}>
          surface: {isAR ? "AR (opaque)" : "VR (frosted)"}
        </button>
      </div>
    </div>
  );
}
