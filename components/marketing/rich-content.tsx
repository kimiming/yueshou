import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
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
  "font",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "mark",
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
  "align",
  "aria-label",
  "color",
  "colspan",
  "datetime",
  "href",
  "alt",
  "height",
  "lang",
  "loading",
  "rel",
  "rowspan",
  "scope",
  "style",
  "src",
  "target",
  "title",
  "width",
] as const;

function safeCssColor(value: string) {
  const color = value.trim();
  if (/^#[0-9a-f]{3,8}$/iu.test(color)) return color;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/iu.test(color)) return color;
  if (/^(?:black|blue|cyan|gray|green|grey|orange|pink|purple|red|transparent|white|yellow)$/iu.test(color)) return color.toLowerCase();
  return null;
}

function safeStyleValue(property: string, value: string) {
  const trimmed = value.trim();
  if (/url\s*\(|expression\s*\(|javascript:|@import/iu.test(trimmed)) return null;
  if (property === "color" || property === "background-color") return safeCssColor(trimmed);
  if (property === "text-align" && /^(?:left|right|center|justify)$/iu.test(trimmed)) return trimmed.toLowerCase();
  if (property === "font-weight" && /^(?:normal|bold|[1-9]00)$/u.test(trimmed)) return trimmed.toLowerCase();
  if (property === "font-style" && /^(?:normal|italic)$/iu.test(trimmed)) return trimmed.toLowerCase();
  if ((property === "text-decoration" || property === "text-decoration-line") && /^(?:none|underline|line-through)$/iu.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function appendStyle(element: Element, declaration: string) {
  element.setAttribute("style", [element.getAttribute("style"), declaration].filter(Boolean).join("; "));
}

function sanitizeStyles(root: HTMLElement) {
  root.querySelectorAll("font[color]").forEach((font) => {
    const color = safeCssColor(font.getAttribute("color") ?? "");
    if (color) appendStyle(font, `color: ${color}`);
    font.removeAttribute("color");
  });
  root.querySelectorAll("[align]").forEach((element) => {
    const align = element.getAttribute("align")?.trim().toLowerCase();
    if (align && /^(?:left|right|center|justify)$/u.test(align)) appendStyle(element, `text-align: ${align}`);
    element.removeAttribute("align");
  });
  root.querySelectorAll("[style]").forEach((element) => {
    const declarations = (element.getAttribute("style") ?? "")
      .split(";")
      .flatMap((declaration) => {
        const separator = declaration.indexOf(":");
        if (separator < 1) return [];
        const property = declaration.slice(0, separator).trim().toLowerCase();
        const value = safeStyleValue(property, declaration.slice(separator + 1));
        return value ? [`${property}: ${value}`] : [];
      });
    if (declarations.length) element.setAttribute("style", declarations.join("; "));
    else element.removeAttribute("style");
  });
}

export function sanitizeRichContent(html: string) {
  const root = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
    FORBID_TAGS: ["iframe", "object", "embed", "script", "style", "form", "input", "button"],
    RETURN_DOM: true,
  }) as HTMLElement;

  sanitizeStyles(root);

  // Older editor versions inserted the uploaded filename as a visible caption.
  // It is media metadata rather than authored page content, so do not render it.
  root.querySelectorAll("figcaption").forEach((caption) => caption.remove());

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
      data-rich-content
      dangerouslySetInnerHTML={{ __html: sanitizeRichContent(html) }}
    />
  );
}
