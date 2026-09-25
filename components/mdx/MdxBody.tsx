import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import clsx from "clsx";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";
import { Figure, YouTube, Video } from "./media";

/**
 * Renders MDX with our site's styled HTML elements so content authors
 * (you, editing files in /content) don't have to think about styling.
 */
const components = {
  h1: (p: ComponentProps<"h1">) => <h1 {...p} />,
  h2: (p: ComponentProps<"h2">) => <h2 {...p} />,
  h3: (p: ComponentProps<"h3">) => <h3 {...p} />,
  p: (p: ComponentProps<"p">) => <p {...p} />,
  ul: (p: ComponentProps<"ul">) => <ul {...p} />,
  ol: (p: ComponentProps<"ol">) => <ol {...p} />,
  li: (p: ComponentProps<"li">) => <li {...p} />,
  a: ({ href = "", ...rest }: ComponentProps<"a">) => {
    const external = href.startsWith("http");
    return external ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        {...rest}
      />
    ) : (
      <Link href={href} {...rest} />
    );
  },
  strong: (p: ComponentProps<"strong">) => <strong {...p} />,
  code: (p: ComponentProps<"code">) => <code {...p} />,
  img: ({ alt = "", ...rest }: ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="article-image" alt={alt} loading="lazy" {...rest} />
  ),
  // Custom media components usable directly in MDX.
  Figure,
  YouTube,
  Video,
};

export function MdxBody({ source, className }: { source: string; className?: string }) {
  return (
    <div className={clsx("article-content", className)}>
      <MDXRemote
        source={source}
        components={components}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
      />
    </div>
  );
}
