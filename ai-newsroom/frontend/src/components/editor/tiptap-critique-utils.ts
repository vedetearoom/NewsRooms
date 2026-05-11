import type { Editor } from "@tiptap/core";
import type { CritiqueItem } from "@/lib/api";

export function detectModifiedCritiqueMarks(
  editor: Editor,
  critiques: CritiqueItem[],
  appliedCritiquesKey: string,
  existingModified: Set<number>,
) {
  if (critiques.length === 0) {
    return null;
  }

  const newModified = new Set<number>();
  const { doc } = editor.state;

  doc.descendants((node) => {
    if (!node.isText) return;
    const marks = node.marks.filter((mark) => mark.type.name === "critiqueMark");
    for (const mark of marks) {
      const idx = mark.attrs.critiqueIndex;
      const originalText = mark.attrs.originalText;
      if (idx >= 0 && originalText) {
        const nodeText = node.text || "";
        if (nodeText !== originalText && !originalText.includes(nodeText)) {
          newModified.add(idx);
        }
      }
    }
  });

  for (let index = 0; index < critiques.length; index++) {
    let found = false;
    doc.descendants((node) => {
      if (found || !node.isText) return;
      const marks = node.marks.filter(
        (mark) => mark.type.name === "critiqueMark" && mark.attrs.critiqueIndex === index,
      );
      if (marks.length > 0) found = true;
    });
    if (!found && appliedCritiquesKey) {
      newModified.add(index);
    }
  }

  let changed = false;
  const merged = new Set(existingModified);
  for (const idx of newModified) {
    if (!merged.has(idx)) {
      merged.add(idx);
      changed = true;
    }
  }

  return changed ? merged : null;
}

export function applyCritiqueMarks(editor: Editor, critiques: CritiqueItem[]) {
  const { doc, tr } = editor.state;
  const markType = editor.schema.marks.critiqueMark;

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const marks = node.marks.filter((mark) => mark.type.name === "critiqueMark");
    marks.forEach((mark) => {
      tr.removeMark(pos, pos + node.nodeSize, mark);
    });
  });
  if (tr.steps.length > 0) {
    editor.view.dispatch(tr);
  }

  if (critiques.length === 0) {
    editor.commands.setTextSelection(0);
    return;
  }

  const { doc: freshDoc } = editor.state;

  for (let index = 0; index < critiques.length; index++) {
    const quote = critiques[index].target_quote;
    if (!quote) continue;

    let found = false;

    freshDoc.descendants((node, pos) => {
      if (found || !node.isText) return;
      const nodeText = node.text || "";
      const quoteIndex = nodeText.indexOf(quote);
      if (quoteIndex >= 0) {
        const from = pos + quoteIndex;
        const to = from + quote.length;

        editor.chain().setTextSelection({ from, to }).setMark(markType, {
          critiqueIndex: index,
          originalText: quote,
          isActive: false,
        }).run();

        found = true;
      }
    });

    if (!found) {
      const fullText = freshDoc.textContent;
      const textIndex = fullText.indexOf(quote);
      if (textIndex >= 0) {
        let charCount = 0;
        let fromPos = -1;
        let toPos = -1;

        freshDoc.descendants((node, pos) => {
          if (fromPos >= 0 && toPos >= 0) return;
          if (!node.isText) return;

          const nodeLen = (node.text || "").length;
          const nodeStart = charCount;
          const nodeEnd = charCount + nodeLen;

          if (fromPos < 0 && textIndex >= nodeStart && textIndex < nodeEnd) {
            fromPos = pos + (textIndex - nodeStart);
          }
          if (fromPos >= 0 && toPos < 0) {
            const quoteEnd = textIndex + quote.length;
            if (quoteEnd <= nodeEnd) {
              toPos = pos + (quoteEnd - nodeStart);
            }
          }
          charCount += nodeLen;
        });

        if (fromPos >= 0 && toPos >= 0) {
          editor.chain().setTextSelection({ from: fromPos, to: toPos }).setMark(markType, {
            critiqueIndex: index,
            originalText: quote,
            isActive: false,
          }).run();
        }
      }
    }
  }

  editor.commands.setTextSelection(0);
}

export function applyLegacyHighlightQuotes(editor: Editor, quotes: string[]) {
  if (quotes.length === 0) return;

  const { doc } = editor.state;
  editor.chain().focus().unsetHighlight().run();

  for (const quote of quotes) {
    let found = false;
    doc.descendants((node, nodePos) => {
      if (found || !node.isText) return;
      const nodeText = node.text || "";
      const quoteIndex = nodeText.indexOf(quote);
      if (quoteIndex >= 0) {
        const from = nodePos + quoteIndex;
        const to = from + quote.length;
        editor.chain().setTextSelection({ from, to }).setHighlight({ color: "yellow" }).run();
        found = true;
      }
    });
  }

  editor.commands.setTextSelection(0);
}
