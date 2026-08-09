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

  return <nav aria-label="Pagination" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
    {page > 1 ? <Link aria-label="Previous page" href={hrefFor(page - 1)}>Previous</Link> : <span aria-hidden="true">Previous</span>}
    <span>Page {page} of {totalPages}</span>
    {page < totalPages ? <Link aria-label="Next page" href={hrefFor(page + 1)}>Next</Link> : <span aria-hidden="true">Next</span>}
  </nav>;
}
