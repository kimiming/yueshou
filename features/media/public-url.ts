export function publicMediaUrl(id: string) {
  return `/api/media/public/${encodeURIComponent(id)}`;
}
