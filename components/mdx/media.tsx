/**
 * MDX media components — usable as JSX tags directly inside any /content .mdx file.
 * All are presentational server components; styling lives in app/article.css.
 */

interface FigureProps {
  src: string;
  alt?: string;
  caption?: string;
  /** Optional max width (e.g. "420px" or "60%") to shrink + center the image. */
  width?: string;
}

/** Centered, responsive image with an optional caption. */
export function Figure({ src, alt = "", caption, width }: FigureProps) {
  return (
    <figure className="article-figure" style={width ? { maxWidth: width } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="article-image" src={src} alt={alt} loading="lazy" />
      {caption && <figcaption className="article-figcaption">{caption}</figcaption>}
    </figure>
  );
}

interface YouTubeProps {
  id: string;
  title?: string;
}

/** Responsive 16:9 YouTube embed. Pass the video id (the part after `v=`). */
export function YouTube({ id, title = "YouTube video" }: YouTubeProps) {
  return (
    <div className="article-video">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

interface VideoProps {
  src: string;
  poster?: string;
}

/** Self-hosted video clip with native controls. */
export function Video({ src, poster }: VideoProps) {
  return (
    <div className="article-video">
      <video controls poster={poster} preload="metadata">
        <source src={src} />
      </video>
    </div>
  );
}
