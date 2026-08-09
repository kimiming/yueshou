import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "blockquote",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
] as const;

const ALLOWED_ATTR = [
  "abbr",
  "aria-label",
  "colspan",
  "datetime",
  "href",
  "lang",
  "rel",
  "rowspan",
  "scope",
  "target",
  "title",
] as const;

export function sanitizeRichContent(html: string) {
  const root = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
    FORBID_TAGS: ["iframe", "object", "embed", "script", "style", "form", "input", "button"],
    FORBID_ATTR: ["style"],
    RETURN_DOM: true,
  }) as HTMLElement;

  root.querySelectorAll("a[target='_blank']").forEach((link) => {
    const rel = new Set((link.getAttribute("rel") ?? "").split(/\s+/u).filter(Boolean));
    rel.add("noopener");
    rel.add("noreferrer");
    link.setAttribute("rel", [...rel].join(" "));
  });

  return root.innerHTML;
}

export function plainTextExcerpt(html: string, maxLength = 240) {
  const root = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ["iframe", "object", "embed", "script", "style", "form", "input", "button"],
    RETURN_DOM: true,
  }) as HTMLElement;
  const text = (root.textContent ?? "").replace(/\s+/gu, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function RichContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={["rich-content", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: sanitizeRichContent(html) }}
    />
  );
}
