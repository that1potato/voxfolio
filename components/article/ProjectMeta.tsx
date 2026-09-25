interface Props {
  tech?: string[];
  repo?: string;
  demo?: string;
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 3H3.25A1.25 1.25 0 002 4.25v8.5A1.25 1.25 0 003.25 14h8.5A1.25 1.25 0 0013 12.75V9.5" />
      <path d="M9.5 2.5H13.5V6.5" />
      <path d="M7 9 13.5 2.5" />
    </svg>
  );
}

/**
 * Header block shown above a project's MDX body: repo/demo links and the tech
 * stack as pill badges. Renders nothing when no fields are set.
 */
export function ProjectMeta({ tech, repo, demo }: Props) {
  const hasActions = Boolean(repo || demo);
  const hasTags = Boolean(tech && tech.length > 0);

  if (!hasActions && !hasTags) return null;

  return (
    <div className="article-meta">
      {hasActions && (
        <div className="article-meta-actions">
          {demo && (
            <a
              className="project-link project-link--primary"
              href={demo}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalIcon />
              Live demo
            </a>
          )}
          {repo && (
            <a
              className="project-link project-link--secondary"
              href={repo}
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon />
              Repository
            </a>
          )}
        </div>
      )}
      {hasTags && (
        <div className="article-meta-tags">
          {tech!.map((t) => (
            <span key={t} className="project-tag">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
