import clsx from "clsx";
import type { HTMLAttributes, Ref } from "react";

interface Props {
  as?: "article" | "div" | "section";
  children: React.ReactNode;
  className?: string;
  rootRef?: Ref<HTMLDivElement>;
  surfaceClassName?: string;
  surfaceProps?: HTMLAttributes<HTMLElement>;
}

export function ArticleGlassSurface({
  as: Tag = "section",
  children,
  className,
  rootRef,
  surfaceClassName,
  surfaceProps,
}: Props) {
  return (
    <div ref={rootRef} className={clsx("article-glass", className)}>
      <div className="article-glass-backdrop" aria-hidden="true" />
      <div className="article-glass-highlight" aria-hidden="true" />
      <Tag
        {...surfaceProps}
        className={clsx(
          "article-surface",
          surfaceClassName,
          surfaceProps?.className,
        )}
      >
        {children}
      </Tag>
    </div>
  );
}
