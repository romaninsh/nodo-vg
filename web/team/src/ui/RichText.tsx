import { Suspense, lazy, useMemo } from "react";
import DOMPurify from "dompurify";

// The editor (Tiptap and ProseMirror) is its own chunk, fetched when a form first shows one;
// until it arrives the cleaned HTML shows in its place.
const RichTextEditor = lazy(() => import("./RichTextEditor"));

// What nodo shows and edits: Odoo's text formatting, lists and checklists, quotes, code,
// links, rules and tables. Odoo's sanitiser has the last word on what is stored; this list is
// the browser's own guard before any of it reaches the page.
const TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "code", "pre", "span", "font", "mark", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "a", "hr", "div",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
];
const ATTRS = ["href", "target", "rel", "class", "style", "colspan", "rowspan", "start", "data-checked", "data-type", "data-color"];
// Only colours survive in a style attribute: no positioning, no url() fetches.
const STYLE_KEEP = new Set(["color", "background-color"]);

const purify = DOMPurify();
// Only Odoo's own content classes (checklists, theme colours, code languages): a stored
// class can't borrow the app's styles.
const CLASS_KEEP = /^(o_checklist|o_checked|oe-nested|(text|bg)-o-color-\d|language-[\w-]+)$/;

purify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "class") {
    const kept = data.attrValue.split(/\s+/).filter((c) => CLASS_KEEP.test(c));
    if (kept.length) data.attrValue = kept.join(" ");
    else data.keepAttr = false;
    return;
  }
  if (data.attrName !== "style") return;
  const kept = data.attrValue.split(";").map((d) => d.trim()).filter((d) => {
    const [prop, ...rest] = d.split(":");
    const value = rest.join(":").toLowerCase();
    return STYLE_KEEP.has((prop ?? "").trim().toLowerCase()) && !value.includes("url(") && !value.includes("expression(");
  });
  if (kept.length) data.attrValue = kept.join("; ");
  else data.keepAttr = false;
});
purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
});

/** Stored HTML, cleaned for the page: only the tags and colours nodo shows, safe links. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return purify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false });
}

/**
 * What Odoo's editor can put in a description that nodo's can't edit yet. Saving such a
 * description from nodo would drop it, so the field stays read-only and says why.
 */
export function unsupportedParts(html: string | null | undefined): string[] {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = new Set<string>();
  if (doc.querySelector("img, picture, video, audio, iframe, svg, object, embed")) found.add("images or media");
  if (doc.querySelector(".o_text_columns, .row > [class*='col-']")) found.add("columns");
  if (doc.querySelector(".o_editor_banner")) found.add("banners");
  if (doc.querySelector("[data-embedded], [data-oe-protected], details")) found.add("embedded blocks");
  if (doc.querySelector("a.btn, .o_stars, .o_signature")) found.add("buttons, stars or signatures");
  return [...found];
}

/** Read-only: the description's cleaned HTML, laid out as in the editor. */
export function RichTextView({ value, label, empty }: { value: string | null | undefined; label: string; empty?: string }) {
  const html = useMemo(() => sanitizeHtml(value), [value]);
  if (!html.replace(/<[^>]*>/g, "").trim() && !/<(hr|table|li)\b/i.test(html)) {
    return <div className="rt rt-view rt-empty" role="region" aria-label={label}>{empty ?? "Nothing written yet."}</div>;
  }
  return <div className="rt rt-view" role="region" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
}

type Props = {
  /** The stored HTML. */
  value: string | null | undefined;
  /** The edited HTML; the stored value again when an edit is undone. */
  onChange?: (html: string) => void;
  /** The field's name, for screen readers ("Description"). */
  label: string;
  placeholder?: string;
  /** Read-only, as when the record can't be changed. */
  readOnly?: boolean;
  /** Where to change what nodo can't edit ("Open it in Odoo to change them."). */
  elsewhere?: string;
};

/**
 * Rich text as Odoo stores it: a cleaned read-only view, or an editor with a toolbar on
 * selection, a "/" command menu, checklists, tables, colours and links. A description holding
 * what nodo can't edit (images, columns, banners) stays read-only and says so.
 */
export function RichText({ value, onChange, label, placeholder, readOnly, elsewhere }: Props) {
  const blocked = useMemo(() => unsupportedParts(value), [value]);
  if (readOnly || !onChange || blocked.length) {
    return (
      <div className="rt-field">
        <RichTextView value={value} label={label} />
        {blocked.length > 0 && !readOnly && (
          <p className="muted rt-note">
            This has {blocked.join(", ")}, which nodo can't edit yet, so it is read-only here. {elsewhere ?? "Open it in Odoo to change it."}
          </p>
        )}
      </div>
    );
  }
  return (
    <Suspense fallback={<RichTextView value={value} label={label} empty={placeholder} />}>
      <RichTextEditor value={value ?? ""} onChange={onChange} label={label} placeholder={placeholder} sanitize={sanitizeHtml} />
    </Suspense>
  );
}
