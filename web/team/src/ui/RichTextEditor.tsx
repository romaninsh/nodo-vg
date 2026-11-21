import {
  useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EditorContent, Extension, mergeAttributes, useEditor, useEditorState, type Editor, type Range } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { BackgroundColor, Color, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import {
  Baseline, Bold, Check, Code, Columns3, Heading1, Heading2, Heading3, Highlighter, Italic, Link, List, ListChecks, ListOrdered,
  Minus, Pilcrow, Quote, RemoveFormatting, Rows3, SquareCode, Strikethrough, Table, Trash2, Underline, Unlink, X,
} from "lucide-react";

// Odoo's markup, read and written as Odoo writes it, so a description saved here opens the same
// in Odoo: checklists are `ul.o_checklist` with `li.o_checked`, colours may sit on `<font>`,
// and Odoo's theme colours are classes (`text-o-color-2`).

const Checklist = TaskList.extend({
  parseHTML() {
    return [{ tag: "ul.o_checklist", priority: 60 }, { tag: 'ul[data-type="taskList"]', priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["ul", mergeAttributes(HTMLAttributes, { class: "o_checklist" }), 0];
  },
});

const ChecklistItem = TaskItem.extend({
  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (el: HTMLElement) => el.classList.contains("o_checked") || el.getAttribute("data-checked") === "true",
        renderHTML: (a: { checked?: boolean }) => (a.checked ? { class: "o_checked" } : {}),
      },
    };
  },
  parseHTML() {
    return [
      { tag: "ul.o_checklist > li", priority: 60 },
      { tag: 'li[data-type="taskItem"]', priority: 60, contentElement: (el: HTMLElement) => el.querySelector("div") ?? el },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["li", HTMLAttributes, 0];
  },
});

const O_COLOR = /^(text|bg)-o-color-\d$/;
const oColor = (el: HTMLElement) => [...el.classList].filter((c) => O_COLOR.test(c)).join(" ") || null;
const styled = (el: HTMLElement) => (el.hasAttribute("style") || oColor(el) ? {} : false);

const OdooTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      oColor: { default: null, parseHTML: oColor, renderHTML: (a: { oColor?: string | null }) => (a.oColor ? { class: a.oColor } : {}) },
    };
  },
  parseHTML() {
    return [
      { tag: "span", consuming: false, getAttrs: styled },
      { tag: "font", consuming: false, getAttrs: styled },
    ];
  },
});

// Swatches, named for screen readers. The first entry of each clears it.
const TEXT_COLORS: [string, string | null][] = [
  ["Default", null], ["Red", "#c92a2a"], ["Orange", "#d9480f"], ["Amber", "#e67700"], ["Green", "#2b8a3e"],
  ["Blue", "#1971c2"], ["Violet", "#6741d9"], ["Grey", "#868e96"],
];
const HIGHLIGHTS: [string, string | null][] = [
  ["None", null], ["Red", "#ffe3e3"], ["Orange", "#ffe8cc"], ["Yellow", "#fff3bf"], ["Green", "#d3f9d8"],
  ["Blue", "#d0ebff"], ["Violet", "#e5dbff"], ["Grey", "#e9ecef"],
];

// ---- the "/" command menu ------------------------------------------------------------------

type Command = {
  id: string;
  title: string;
  hint: string;
  icon: ReactNode;
  keywords?: string;
  inTable?: boolean;
  run: (editor: Editor, range: Range) => void;
};

const ICON = 16;
const at = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

/** Ask the editor's toolbar to open its link box (a "/" command can't reach React state). */
const linkRequests = new WeakMap<Editor, () => void>();

const COMMANDS: Command[] = [
  { id: "h1", title: "Heading 1", hint: "Big section heading", icon: <Heading1 size={ICON} />, keywords: "title #", run: (e, r) => at(e, r).setNode("heading", { level: 1 }).run() },
  { id: "h2", title: "Heading 2", hint: "Medium section heading", icon: <Heading2 size={ICON} />, keywords: "subtitle ##", run: (e, r) => at(e, r).setNode("heading", { level: 2 }).run() },
  { id: "h3", title: "Heading 3", hint: "Small section heading", icon: <Heading3 size={ICON} />, keywords: "###", run: (e, r) => at(e, r).setNode("heading", { level: 3 }).run() },
  { id: "text", title: "Text", hint: "Plain paragraph", icon: <Pilcrow size={ICON} />, keywords: "paragraph", run: (e, r) => at(e, r).setParagraph().run() },
  { id: "quote", title: "Quote", hint: "A quoted passage", icon: <Quote size={ICON} />, keywords: "blockquote", run: (e, r) => at(e, r).toggleBlockquote().run() },
  { id: "code", title: "Code", hint: "A block of code", icon: <SquareCode size={ICON} />, keywords: "pre monospace", run: (e, r) => at(e, r).toggleCodeBlock().run() },
  { id: "bullets", title: "Bulleted list", hint: "A simple list", icon: <List size={ICON} />, keywords: "ul unordered", run: (e, r) => at(e, r).toggleBulletList().run() },
  { id: "numbers", title: "Numbered list", hint: "A list with numbers", icon: <ListOrdered size={ICON} />, keywords: "ol ordered", run: (e, r) => at(e, r).toggleOrderedList().run() },
  { id: "checklist", title: "Checklist", hint: "Items to tick off", icon: <ListChecks size={ICON} />, keywords: "todo task checkbox", run: (e, r) => at(e, r).toggleTaskList().run() },
  { id: "separator", title: "Separator", hint: "A horizontal line", icon: <Minus size={ICON} />, keywords: "hr rule divider", run: (e, r) => at(e, r).setHorizontalRule().run() },
  { id: "table", title: "Table", hint: "A 3 × 3 table with a header row", icon: <Table size={ICON} />, run: (e, r) => at(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  {
    id: "link", title: "Link", hint: "A link to a web page", icon: <Link size={ICON} />, keywords: "url href",
    run: (e, r) => {
      at(e, r).insertContent("link").setTextSelection({ from: r.from, to: r.from + 4 }).run();
      linkRequests.get(e)?.();
    },
  },
  { id: "row", title: "Add a row", hint: "Below this one", icon: <Rows3 size={ICON} />, inTable: true, run: (e, r) => at(e, r).addRowAfter().run() },
  { id: "column", title: "Add a column", hint: "Right of this one", icon: <Columns3 size={ICON} />, inTable: true, run: (e, r) => at(e, r).addColumnAfter().run() },
  { id: "delrow", title: "Delete the row", hint: "This row", icon: <Trash2 size={ICON} />, inTable: true, run: (e, r) => at(e, r).deleteRow().run() },
  { id: "delcolumn", title: "Delete the column", hint: "This column", icon: <Trash2 size={ICON} />, inTable: true, run: (e, r) => at(e, r).deleteColumn().run() },
  { id: "deltable", title: "Delete the table", hint: "The whole table", icon: <Trash2 size={ICON} />, inTable: true, run: (e, r) => at(e, r).deleteTable().run() },
];

function commandsFor(editor: Editor, query: string) {
  const q = query.toLowerCase();
  const inTable = editor.isActive("table");
  return COMMANDS.filter((c) => (!c.inTable || inTable) && `${c.title} ${c.keywords ?? ""}`.toLowerCase().includes(q));
}

type SlashState = { items: Command[]; index: number; rect: DOMRect | null; pick: ((c: Command) => void) | null };
const CLOSED: SlashState = { items: [], index: 0, rect: null, pick: null };

/** The open "/" menu: what the suggestion plugin found, and the highlighted one. */
function slashStore() {
  let state = CLOSED;
  const listeners = new Set<() => void>();
  const set = (s: SlashState) => { state = s; listeners.forEach((l) => l()); };
  const show = (p: SuggestionProps<Command>) =>
    set({ items: p.items, index: Math.min(state.index, Math.max(p.items.length - 1, 0)), rect: p.clientRect?.() ?? null, pick: (c) => p.command(c) });
  return {
    get: () => state,
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
    start: (p: SuggestionProps<Command>) => { state = { ...CLOSED }; show(p); },
    update: show,
    close: () => set(CLOSED),
    key: (event: KeyboardEvent) => {
      const n = state.items.length;
      if (!n) return false;
      if (event.key === "ArrowDown") { set({ ...state, index: (state.index + 1) % n }); return true; }
      if (event.key === "ArrowUp") { set({ ...state, index: (state.index + n - 1) % n }); return true; }
      if (event.key === "Enter" || event.key === "Tab") {
        const c = state.items[state.index];
        if (c) state.pick?.(c);
        return true;
      }
      return false;
    },
  };
}
type SlashStore = ReturnType<typeof slashStore>;

const slashCommands = (store: SlashStore) =>
  Extension.create({
    name: "slashCommands",
    addProseMirrorPlugins() {
      return [
        Suggestion<Command>({
          editor: this.editor,
          char: "/",
          items: ({ query, editor }) => commandsFor(editor, query),
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => ({
            onStart: store.start,
            onUpdate: store.update,
            onKeyDown: ({ event }) => store.key(event),
            onExit: store.close,
          }),
        }),
      ];
    },
  });

function SlashMenu({ store, editor, id }: { store: SlashStore; editor: Editor; id: string }) {
  const { items, index, rect, pick } = useSyncExternalStore(store.subscribe, store.get);
  const open = items.length > 0 && rect !== null;
  // The editor keeps focus while the menu is open; the highlighted command is announced through
  // aria-activedescendant, as a combobox does.
  useEffect(() => {
    const dom = editor.view.dom;
    if (open) {
      dom.setAttribute("aria-controls", id);
      dom.setAttribute("aria-activedescendant", `${id}-${items[index]?.id}`);
    } else {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    }
  }, [open, index, items, editor, id]);
  if (!open) return null;
  const top = Math.min(rect.bottom + 4, window.innerHeight - 320);
  return createPortal(
    <div className="popover rt-slash" style={{ position: "fixed", top, left: rect.left }}>
      <ul id={id} role="listbox" aria-label="Commands" className="menu">
        {items.map((c, i) => (
          <li key={c.id} id={`${id}-${c.id}`} role="option" aria-selected={i === index}
            className="menu-item rt-cmd" data-focused={i === index || undefined}
            onMouseDown={(e) => { e.preventDefault(); pick?.(c); }}>
            <span className="rt-cmd-icon" aria-hidden="true">{c.icon}</span>
            <span><span className="rt-cmd-title">{c.title}</span><span className="rt-cmd-hint">{c.hint}</span></span>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}

// ---- the toolbar on a selection ------------------------------------------------------------

type Panel = "main" | "link" | "color" | "highlight";

function ToolButton({ label, keys, active, onPress, children }: { label: string; keys?: string; active?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`rt-tool${active ? " on" : ""}`} aria-label={label} title={keys ? `${label} (${keys})` : label}
      aria-pressed={active === undefined ? undefined : active} aria-keyshortcuts={keys} tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()} onClick={onPress}>
      {children}
    </button>
  );
}

/** Arrow keys move between the toolbar's buttons; Escape goes back to the text. */
function rove(e: ReactKeyboardEvent<HTMLDivElement>, editor: Editor, back: () => void) {
  const buttons = [...e.currentTarget.querySelectorAll<HTMLElement>("button")];
  const i = buttons.indexOf(document.activeElement as HTMLElement);
  const go = (n: number) => { e.preventDefault(); buttons[(n + buttons.length) % buttons.length]?.focus(); };
  if (e.key === "ArrowRight") go(i + 1);
  else if (e.key === "ArrowLeft") go(i - 1);
  else if (e.key === "Home") go(0);
  else if (e.key === "End") go(buttons.length - 1);
  else if (e.key === "Escape") { e.preventDefault(); back(); editor.commands.focus(); }
}

function SelectionToolbar({ editor, toolbarRef }: { editor: Editor; toolbarRef: MutableRefObject<HTMLDivElement | null> }) {
  const [panel, setPanel] = useState<Panel>("main");
  const [href, setHref] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      code: e.isActive("code"), link: e.isActive("link"), href: (e.getAttributes("link").href as string | undefined) ?? "",
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      background: (e.getAttributes("textStyle").backgroundColor as string | undefined) ?? null,
    }),
  });
  const openLink = () => { setHref(state.href); setPanel("link"); };
  useEffect(() => {
    linkRequests.set(editor, () => { setHref(""); setPanel("link"); });
    return () => { linkRequests.delete(editor); };
  }, [editor]);
  // A new selection starts on the buttons again.
  useEffect(() => {
    const reset = () => setPanel((p) => (p === "link" && document.activeElement?.closest(".rt-toolbar") ? p : "main"));
    editor.on("selectionUpdate", reset);
    return () => { editor.off("selectionUpdate", reset); };
  }, [editor]);
  // Ctrl+K opens the link box on a selection.
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !editor.state.selection.empty) { e.preventDefault(); openLink(); }
    };
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  });
  const applyLink = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url) chain.setLink({ href: /^[a-z][\w+.-]*:|^\//i.test(url) ? url : `https://${url}` }).run();
    else chain.unsetLink().run();
    setPanel("main");
  };
  // A mouse press keeps the focus in the text; Tiptap's focus() would restore the selection a
  // frame later, over whatever was typed meanwhile. Only a keyboard visit to the toolbar needs it.
  const c = () => (editor.view.hasFocus() ? editor.chain() : editor.chain().focus());

  return (
    <BubbleMenu editor={editor} options={{ placement: "top-start", offset: 8 }}>
      <div ref={toolbarRef} className="popover rt-toolbar" role="toolbar" aria-label="Formatting" aria-orientation="horizontal"
        onKeyDown={(e) => { if (panel !== "link") rove(e, editor, () => setPanel("main")); }}>
        {panel === "main" && (
          <>
            <ToolButton label="Bold" keys="Control+B" active={state.bold} onPress={() => c().toggleBold().run()}><Bold size={ICON} /></ToolButton>
            <ToolButton label="Italic" keys="Control+I" active={state.italic} onPress={() => c().toggleItalic().run()}><Italic size={ICON} /></ToolButton>
            <ToolButton label="Underline" keys="Control+U" active={state.underline} onPress={() => c().toggleUnderline().run()}><Underline size={ICON} /></ToolButton>
            <ToolButton label="Strikethrough" keys="Control+Shift+S" active={state.strike} onPress={() => c().toggleStrike().run()}><Strikethrough size={ICON} /></ToolButton>
            <ToolButton label="Inline code" keys="Control+E" active={state.code} onPress={() => c().toggleCode().run()}><Code size={ICON} /></ToolButton>
            <span className="rt-sep" aria-hidden="true" />
            <ToolButton label="Text colour" onPress={() => setPanel("color")}>
              <Baseline size={ICON} style={{ color: state.color ?? undefined }} />
            </ToolButton>
            <ToolButton label="Highlight" onPress={() => setPanel("highlight")}>
              <Highlighter size={ICON} style={{ background: state.background ?? undefined }} />
            </ToolButton>
            <ToolButton label={state.link ? "Edit the link" : "Link"} keys="Control+K" active={state.link} onPress={openLink}><Link size={ICON} /></ToolButton>
            {state.link && <ToolButton label="Remove the link" onPress={() => c().extendMarkRange("link").unsetLink().run()}><Unlink size={ICON} /></ToolButton>}
            <ToolButton label="Clear formatting" onPress={() => c().unsetAllMarks().run()}><RemoveFormatting size={ICON} /></ToolButton>
          </>
        )}
        {(panel === "color" || panel === "highlight") && (
          <>
            {(panel === "color" ? TEXT_COLORS : HIGHLIGHTS).map(([name, value]) => (
              <ToolButton key={name} label={`${panel === "color" ? "Text colour" : "Highlight"}: ${name}`}
                active={(panel === "color" ? state.color : state.background) === value}
                onPress={() => {
                  if (panel === "color") (value ? c().setColor(value) : c().unsetColor()).run();
                  else (value ? c().setBackgroundColor(value) : c().unsetBackgroundColor()).run();
                  setPanel("main");
                }}>
                <span className={`rt-swatch${value ? "" : " none"}`} style={panel === "color" ? { color: value ?? undefined } : { background: value ?? undefined }}>
                  {panel === "color" ? "A" : ""}
                </span>
              </ToolButton>
            ))}
            <ToolButton label="Back" onPress={() => setPanel("main")}><X size={ICON} /></ToolButton>
          </>
        )}
        {panel === "link" && (
          <form className="rt-link" onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
            <input autoFocus type="text" inputMode="url" aria-label="Link address" placeholder="https://…" value={href}
              onChange={(e) => setHref(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setPanel("main"); editor.commands.focus(); } }} />
            <button type="submit" className="rt-tool" aria-label="Apply the link"><Check size={ICON} /></button>
            <button type="button" className="rt-tool" aria-label="Cancel" onClick={() => { setPanel("main"); editor.commands.focus(); }}><X size={ICON} /></button>
          </form>
        )}
      </div>
    </BubbleMenu>
  );
}

// ---- the editor ----------------------------------------------------------------------------

let uid = 0;

/**
 * The HTML to store: empty for an empty editor, and without the empty paragraphs the editor
 * keeps at the end (after a quote or a table, so the cursor can leave it), which it adds as
 * soon as it gets focus.
 */
const htmlOf = (e: Editor) => (e.isEmpty ? "" : e.getHTML().replace(/(<p><\/p>)+$/, ""));

type Props = {
  value: string;
  onChange: (html: string) => void;
  label: string;
  placeholder?: string;
  sanitize: (html: string) => string;
};

/**
 * Tiptap with Odoo's markup. Reports the HTML on every change, or the stored value itself when
 * the text is back to what was loaded, so undoing every change leaves the form clean.
 */
export default function RichTextEditor({ value, onChange, label, placeholder, sanitize }: Props) {
  const id = useMemo(() => `rt-${++uid}`, []);
  const store = useMemo(slashStore, []);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  // The stored value, and the editor's own HTML for it: the two differ in spelling only.
  const loaded = useRef({ value, html: "" });
  const lastSent = useRef(value);
  const changed = useRef(onChange);
  changed.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Checklist,
      ChecklistItem.configure({ nested: true, a11y: { checkboxLabel: (node, checked) => `${checked ? "Done" : "To do"}: ${node.textContent || "empty item"}` } }),
      TableKit.configure({ table: { resizable: false } }),
      OdooTextStyle,
      Color,
      BackgroundColor,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      slashCommands(store),
    ],
    content: sanitize(value),
    editorProps: {
      attributes: { class: "rt rt-content", role: "textbox", "aria-multiline": "true", "aria-label": label, "aria-describedby": `${id}-help` },
      transformPastedHTML: sanitize,
      handleKeyDown: (_view, event) => {
        // Alt+F10 reaches the toolbar on a selection, as in most editors.
        if (event.altKey && event.key === "F10") {
          const first = toolbarRef.current?.querySelector<HTMLElement>("button");
          if (first) { event.preventDefault(); first.focus(); return true; }
        }
        return false;
      },
    },
    onCreate: ({ editor: e }) => { loaded.current.html = htmlOf(e); },
    onUpdate: ({ editor: e }) => {
      const html = htmlOf(e);
      const out = html === loaded.current.html || (html === "" && !loaded.current.value) ? loaded.current.value : html;
      lastSent.current = out;
      changed.current(out);
    },
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
  });

  // A new stored value (saved, discarded, changed in Odoo) replaces the text, unless it is what
  // this editor just reported.
  useEffect(() => {
    if (!editor || value === lastSent.current) return;
    editor.commands.setContent(sanitize(value), { emitUpdate: false });
    loaded.current = { value, html: htmlOf(editor) };
    lastSent.current = value;
  }, [value, editor, sanitize]);

  if (!editor) return null;
  return (
    <div className="rt-field rt-editing">
      <EditorContent editor={editor} />
      <p id={`${id}-help`} className="sr-only">Type / for commands. Select text for the formatting toolbar; Alt+F10 moves to it.</p>
      <SelectionToolbar editor={editor} toolbarRef={toolbarRef} />
      <SlashMenu store={store} editor={editor} id={`${id}-commands`} />
    </div>
  );
}
