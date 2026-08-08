import Link from "next/link";

import type { ArticleViewModel } from "@/features/content/view-models";

export function ArticleCard({ article }: { article: ArticleViewModel }) {
  return (
    <article className="content-card">
      <p className="content-card__meta">{article.category.title}</p>
      <h3><Link href={`/${article.locale}/news/${article.slug}`}>{article.title}</Link></h3>
      {article.excerpt ? <p>{article.excerpt}</p> : null}
      {article.publishedAt ? <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(article.locale).format(new Date(article.publishedAt))}</time> : null}
    </article>
  );
}
