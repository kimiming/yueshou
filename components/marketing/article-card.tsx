import Link from "next/link";
import Image from "next/image";

import { plainTextExcerpt } from "@/components/marketing/rich-content";
import type { ArticleViewModel } from "@/features/content/view-models";
import { publicMediaUrl } from "@/features/media/public-url";

export function ArticleCard({ article }: { article: ArticleViewModel }) {
  return (
    <article className="news-list-item" lang={article.translationLocale}>
      <Link className="news-list-item__cover" href={`/${article.locale}/news/${article.slug}`} aria-label={article.title}>
        {article.coverMedia ? <Image src={publicMediaUrl(article.coverMedia.id)} alt={article.coverMedia.alt || article.title} fill sizes="(max-width: 720px) 100vw, 360px" /> : <span aria-hidden="true" />}
      </Link>
      <div className="news-list-item__content">
        <p className="content-card__meta">{article.category.title}</p>
        <h3><Link href={`/${article.locale}/news/${article.slug}`}>{article.title}</Link></h3>
        <p>{plainTextExcerpt(article.excerpt || article.body, 220)}</p>
        {article.publishedAt ? <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(article.locale).format(new Date(article.publishedAt))}</time> : null}
      </div>
    </article>
  );
}
