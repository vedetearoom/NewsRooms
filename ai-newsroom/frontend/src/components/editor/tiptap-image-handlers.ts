import { api } from "@/lib/api";
import type { EditorView } from "@tiptap/pm/view";
import type { Slice } from "@tiptap/pm/model";

function replaceTempImage(view: EditorView, tempUrl: string, nextUrl: string) {
  const { state, dispatch } = view;
  state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src === tempUrl) {
      dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, src: nextUrl, alt: "" }));
    }
  });
}

function uploadDroppedOrPastedImage(view: EditorView, file: File, insertAt?: number) {
  const tempUrl = URL.createObjectURL(file);
  const { schema } = view.state;
  const imageNode = schema.nodes.image.create({ src: tempUrl, alt: "uploading" });

  if (typeof insertAt === "number") {
    view.dispatch(view.state.tr.insert(insertAt, imageNode));
  } else {
    view.dispatch(view.state.tr.replaceSelectionWith(imageNode));
  }

  api.uploadImage(file)
    .then((data) => {
      if (data.url) {
        replaceTempImage(view, tempUrl, data.url);
      }
    })
    .catch((error) => {
      console.error("Image upload failed:", error);
    })
    .finally(() => {
      URL.revokeObjectURL(tempUrl);
    });
}

export function handleEditorPaste(view: EditorView, event: ClipboardEvent) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return false;

  event.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return false;

  uploadDroppedOrPastedImage(view, file);
  return true;
}

export function handleEditorDrop(view: EditorView, event: DragEvent, _slice: Slice, moved: boolean) {
  if (moved) return false;

  const files = Array.from(event.dataTransfer?.files || []);
  const imageFile = files.find((file) => file.type.startsWith("image/"));
  if (!imageFile) return false;

  event.preventDefault();
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coordinates) return false;

  uploadDroppedOrPastedImage(view, imageFile, coordinates.pos);
  return true;
}
