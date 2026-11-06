import type { ImportedDocument } from '@api'
import type { Editor } from '@tiptap/core'
import { yUndoPluginKey } from '@tiptap/y-tiptap'

import { sanitizeJsonContent } from '../../extensions/markdown-paste/markdownPastePlugin'
import { padIdOf } from '../../extensions/pad-unique-id/pad-unique-id'
import { carryHeadingIds, headingIdPlan } from './carryHeadingIds'
import { commitImportedImageSizes } from './commitImportedImageSizes'

/**
 * Replaces the whole pad with converted file content. Shared by Settings import and
 * the Android share receiver. Throws when the editor refuses the content.
 */
export const applyImportedContent = async (
  editor: Editor,
  content: ImportedDocument['content']
): Promise<void> => {
  editor.commands.setContent(
    carryHeadingIds(editor.getJSON(), sanitizeJsonContent(content), padIdOf(editor))
  )
  await commitImportedImageSizes(editor)
  // Replace rewrites the whole document, so an undo into the pre-import state
  // lands on a mix of both.
  if (!editor.isDestroyed) yUndoPluginKey.getState(editor.state)?.undoManager.clear()
}

/** The staged card's preview: the same id pick the replace makes, on the pad as it is now. */
export const planImportedHeadingIds = (editor: Editor, content: ImportedDocument['content']) =>
  headingIdPlan(editor.getJSON(), sanitizeJsonContent(content), padIdOf(editor))
