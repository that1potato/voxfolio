"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { articleTheme } from "@/article.config";
import { ArticleGlassSurface } from "@/components/article/ArticleGlassSurface";
import { ArticleThemeScope } from "@/components/article/ArticleThemeScope";
import type { SiteThemeMode } from "@/theme.config";

type OverlayPhase = "closed" | "opening" | "open" | "closing";

interface Props {
  open: boolean;
  title: string;
  themeMode: SiteThemeMode;
  onClose: () => void;
  onExitComplete: () => void;
  onBack?: () => void;
  onPanelBottomChange?: (bottomPx: number | null) => void;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Reading surface for a section's content. It layers over the upper viewport
 * while the full-screen map camera frames the terrain beneath it.
 */
export function SectionOverlay({
  open,
  title,
  themeMode,
  onClose,
  onExitComplete,
  onBack,
  onPanelBottomChange,
  children,
}: Props) {
  const [phase, setPhase] = useState<OverlayPhase>(
    open ? "opening" : "closed",
  );
  const [titleScrolledOut, setTitleScrolledOut] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const closeRequestedRef = useRef(false);
  const exitCompletedRef = useRef(false);
  phaseRef.current = phase;

  const measurePanelBottom = useCallback(() => {
    const panel = panelRef.current;
    onPanelBottomChange?.(panel ? panel.getBoundingClientRect().bottom : null);
  }, [onPanelBottomChange]);

  const requestClose = useCallback(() => {
    if (
      closeRequestedRef.current ||
      phaseRef.current === "closing" ||
      phaseRef.current === "closed"
    ) {
      return;
    }

    closeRequestedRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      closeRequestedRef.current = false;
      exitCompletedRef.current = false;
      if (phase === "closed" || phase === "closing") {
        setPhase("opening");
      }
      return;
    }

    if (phase === "opening" || phase === "open") {
      setPhase("closing");
    }
  }, [open, phase]);

  useEffect(() => {
    if (phase !== "opening") return;

    let revealFrame = 0;
    const mountFrame = window.requestAnimationFrame(() => {
      revealFrame = window.requestAnimationFrame(() => {
        setPhase(open ? "open" : "closing");
      });
    });

    return () => {
      window.cancelAnimationFrame(mountFrame);
      window.cancelAnimationFrame(revealFrame);
    };
  }, [open, phase]);

  useEffect(() => {
    if (phase !== "closing") return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduceMotion ? 0 : articleTheme.motion.durationMs;

    const completeExit = () => {
      if (exitCompletedRef.current) return;
      exitCompletedRef.current = true;
      setPhase("closed");
      onExitComplete();
    };

    if (duration === 0) {
      completeExit();
      return;
    }

    const panel = panelRef.current;
    const handleAnimationEnd = (event: AnimationEvent) => {
      if (
        event.target === panel &&
        event.animationName === "article-glass-disperse"
      ) {
        completeExit();
      }
    };

    panel?.addEventListener("animationend", handleAnimationEnd);
    const timeout = window.setTimeout(completeExit, duration + 100);

    return () => {
      panel?.removeEventListener("animationend", handleAnimationEnd);
      window.clearTimeout(timeout);
    };
  }, [onExitComplete, phase]);

  const mounted = phase !== "closed";

  useEffect(() => {
    if (!mounted) {
      onPanelBottomChange?.(null);
      return;
    }

    const panel = panelRef.current;
    let frame = 0;
    const scheduleMeasure = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measurePanelBottom();
      });
    };
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && panel) {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(panel);
    }

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
    };
  }, [measurePanelBottom, mounted, onPanelBottomChange]);

  useEffect(() => {
    if (!mounted) return;
    const frame = window.requestAnimationFrame(measurePanelBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [measurePanelBottom, mounted, phase]);

  useEffect(() => {
    if (!mounted) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (onBack) {
          onBack();
        } else {
          requestClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const dialog =
        closeButtonRef.current?.closest<HTMLElement>('[role="dialog"]');
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focused = document.activeElement;

      if (event.shiftKey && (focused === first || !dialog.contains(focused))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (focused === last || !dialog.contains(focused))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [mounted, requestClose, onBack]);

  // Track whether the masthead title has scrolled out of view, so the floating
  // top-left title can fade in. Reset on content change (title prop changes).
  useEffect(() => {
    if (!mounted) return;
    const root = scrollRef.current;
    if (!root) return;

    root.scrollTop = 0;
    setTitleScrolledOut(false);

    const update = () => {
      const headline = root.querySelector<HTMLElement>(".article-headline");
      if (!headline) {
        setTitleScrolledOut(false);
        return;
      }
      const rootTop = root.getBoundingClientRect().top;
      const headlineBottom = headline.getBoundingClientRect().bottom;
      setTitleScrolledOut(headlineBottom <= rootTop + 8);
    };

    // Measure after layout settles so a freshly-opened article doesn't flash
    // the floating title before its masthead is positioned.
    const frame = window.requestAnimationFrame(update);
    root.addEventListener("scroll", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      root.removeEventListener("scroll", update);
    };
  }, [mounted, title]);

  if (!mounted) return null;

  return (
    <ArticleThemeScope
      mode={themeMode}
      className={`article-reading-layer article-reading-${phase} fixed inset-x-0 top-0 bottom-[8dvh] z-40 flex p-4 sm:p-6 md:bottom-[12dvh] md:p-8 lg:p-10`}
    >
      <ArticleGlassSurface
        rootRef={panelRef}
        className="article-reading-motion mx-auto flex h-full min-h-0 w-full flex-col"
        surfaceClassName="flex min-h-0 flex-1 flex-col"
        surfaceProps={{
          role: "dialog",
          "aria-modal": true,
          "aria-label": title,
        }}
      >
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-14 sm:px-6 sm:pb-6 sm:pt-16"
        >
          {children}
        </div>

        {/* Floating title — fades in once the masthead scrolls out of view. */}
        <div
          className={`article-floating-title${titleScrolledOut ? " is-visible" : ""}`}
          aria-hidden={!titleScrolledOut}
        >
          {title}
        </div>

        {/* Floating action — always visible, no bar behind it. */}
        <div className="article-floating-action">
          {onBack ? (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="article-close"
            >
              Back
            </button>
          ) : (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="article-close"
            >
              Close
            </button>
          )}
        </div>
      </ArticleGlassSurface>
    </ArticleThemeScope>
  );
}
