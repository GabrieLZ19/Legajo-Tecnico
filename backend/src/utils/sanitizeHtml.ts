import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "span",
    "div",
    "figure",
    "figcaption",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "u",
    "s",
    "br",
    "hr",
    "video",
    "source",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height", "style"],
    td: ["colspan", "rowspan", "style", "bgcolor", "align"],
    th: ["colspan", "rowspan", "style", "bgcolor", "align"],
    table: ["style", "border", "cellpadding", "cellspacing", "width"],
    col: ["span", "width", "style"],
    source: ["src", "type"],
    video: ["src", "controls", "width", "height"],
    "*": ["style", "class", "align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  allowProtocolRelative: false,
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/, /^[a-z]+$/],
      "background-color": [
        /^#[0-9a-fA-F]{3,8}$/,
        /^rgb\(/,
        /^rgba\(/,
        /^[a-z]+$/,
      ],
      "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      "font-size": [/^\d+(\.\d+)?(px|em|rem|%)$/],
      "font-weight": [/^\d+$/, /^bold$/, /^normal$/],
      width: [/^\d+(\.\d+)?(px|%|em)?$/],
      height: [/^\d+(\.\d+)?(px|%|em)?$/],
      "max-width": [/^\d+(\.\d+)?(px|%|em)?$/],
      padding: [/^\d+(\.\d+)?(px|em|%)?( \d+(\.\d+)?(px|em|%)?){0,3}$/],
      margin: [/^\d+(\.\d+)?(px|em|%)?( \d+(\.\d+)?(px|em|%)?){0,3}$/],
      border: [/.*/],
      "border-collapse": [/^collapse$/, /^separate$/],
    },
  },
};

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
