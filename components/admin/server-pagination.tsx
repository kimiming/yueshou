import Link from "next/link";

type QueryValue = string | undefined;

export function AdminPagination({
  pathname,
  currentPage,
  totalItems,
  pageSize,
  query = {},
}: {
  pathname: string;
  currentPage: number;
  totalItems: number;
  pageSize: number;
  query?: Record<string, QueryValue>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const hrefFor = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${pathname}?${params.toString()}`;
  };

  return <nav aria-label="分页" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
    {page > 1 ? <Link aria-label="上一页" href={hrefFor(page - 1)}>上一页</Link> : <span aria-hidden="true">上一页</span>}
    <span>第 {page} 页，共 {totalPages} 页</span>
    {page < totalPages ? <Link aria-label="下一页" href={hrefFor(page + 1)}>下一页</Link> : <span aria-hidden="true">下一页</span>}
  </nav>;
}
