import DOMPurify from "dompurify";

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["figure", "figcaption", "colgroup", "col"],
    ADD_ATTR: ["align", "bgcolor", "colspan", "rowspan", "target", "rel"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto):|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,)/i,
  });
}
