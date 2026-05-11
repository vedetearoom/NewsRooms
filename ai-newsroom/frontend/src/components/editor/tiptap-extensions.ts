/**
 * Custom TipTap / ProseMirror extensions for the AI Newsroom editor.
 *
 * Extracted from tiptap-editor.tsx to keep extension definitions
 * separate from the React component logic.
 */

import { Mark, Node, Extension, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/* ── Custom CritiqueMark Extension ──────────────────────────────
   A ProseMirror Mark that sticks to its text. When surrounding
   content is edited, ProseMirror automatically adjusts offsets
   so the mark never drifts away from its annotated text.
   ─────────────────────────────────────────────────────────────── */
export const CritiqueMark = Mark.create({
  name: "critiqueMark",
  priority: 1001, // higher than highlight so it renders on top

  addAttributes() {
    return {
      critiqueIndex: { default: -1 },
      originalText: { default: "" },
      isActive: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-critique-mark]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const idx = HTMLAttributes.critiqueIndex ?? -1;
    const isActive = HTMLAttributes.isActive === true || HTMLAttributes.isActive === "true";
    return [
      "span",
      mergeAttributes(
        {
          "data-critique-mark": "",
          "data-critique-index": idx,
          class: `critique-mark${isActive ? " critique-mark-active" : ""}`,
        },
        // omit internal attrs from DOM
        (() => {
          const rest = { ...HTMLAttributes };
          delete rest.critiqueIndex;
          delete rest.originalText;
          delete rest.isActive;
          return rest;
        })()
      ),
      0,
    ];
  },
});

/* ── Custom Heading that preserves `id` attributes ───────────
   TipTap's default heading strips all HTML attrs. We extend it
   to carry `id` through, so TOC links work with getElementById.
   ─────────────────────────────────────────────────────────── */
export const HeadingWithId = Node.create({
  name: "heading",
  content: "inline*",
  group: "block",
  defining: true,

  addAttributes() {
    return {
      level: { default: 1 },
      id: { default: null },
    };
  },

  parseHTML() {
    return [1, 2, 3].map((level) => ({
      tag: `h${level}`,
      attrs: { level },
      getAttrs: (node) => ({
        level,
        id: (node as HTMLElement).getAttribute("id") || null,
      }),
    }));
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as number;
    return [
      `h${level}`,
      mergeAttributes(HTMLAttributes, node.attrs.id ? { id: node.attrs.id } : {}),
      0,
    ];
  },
});

/* ── Selection Persist Extension ──────────────────────────────
   Ensures the text selection remains visually highlighted even 
   when the editor loses focus (e.g. when typing in BubbleMenu)
   ─────────────────────────────────────────────────────────── */
export const SelectionPersist = Extension.create({
  name: "selectionPersist",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("selectionPersist"),
        props: {
          decorations(state) {
            const { selection } = state;
            if (selection.empty) return null;
            
            return DecorationSet.create(state.doc, [
              Decoration.inline(selection.from, selection.to, {
                class: "selection-persist",
              }),
            ]);
          },
        },
      }),
    ];
  },
});
