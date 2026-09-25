import clsx from "clsx";
import {
  articleTheme,
  getArticleThemeStyle,
  type ArticleThemeMode,
} from "@/article.config";

interface Props {
  children: React.ReactNode;
  className?: string;
  mode?: ArticleThemeMode;
}

export function ArticleThemeScope({
  children,
  className,
  mode = articleTheme.activeMode,
}: Props) {
  return (
    <div
      data-article-theme={mode}
      style={getArticleThemeStyle(mode)}
      className={clsx("article-theme", className)}
    >
      {children}
    </div>
  );
}
