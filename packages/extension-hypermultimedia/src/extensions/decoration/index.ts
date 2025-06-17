// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createMediaResizeGripper, extractImageNode } from "./media-resize-gripper";

export function buildDecorations(
  nodeNames: string[],
  doc: any,
  editorView: any,
  editor: any
): DecorationSet {
  const contentWrappers = extractImageNode(nodeNames, doc, editorView);

  const decos = contentWrappers.map((prob) => {
    const gripper = createMediaResizeGripper(prob, editor);
    const options = {
      side: -1,
      key: prob.keyId || 1,
    };
    return Decoration.widget(prob.from, gripper, options);
  });

  return DecorationSet.create(doc, decos);
}
