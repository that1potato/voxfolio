import { ProjectMeta } from "./ProjectMeta";

interface Props {
  eyebrow?: string;
  title: string;
  lede?: string;
  tech?: string[];
  repo?: string;
  demo?: string;
}

/**
 * Editorial article head: category eyebrow → display title → summary lede →
 * repo/demo/tech. Used at the top of every reading-overlay article.
 */
export function ArticleMasthead({
  eyebrow,
  title,
  lede,
  tech,
  repo,
  demo,
}: Props) {
  return (
    <header className="article-masthead">
      {eyebrow && <p className="article-eyebrow">{eyebrow}</p>}
      <h1 id="section-overlay-title" className="article-headline">
        {title}
      </h1>
      {lede && <p className="article-lede">{lede}</p>}
      <ProjectMeta tech={tech} repo={repo} demo={demo} />
    </header>
  );
}
