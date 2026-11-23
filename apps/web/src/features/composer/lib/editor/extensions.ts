import type { Extensions } from "@tiptap/core"
import {
  ComposerBlockquote,
  ComposerCodeBlock,
  ComposerHeading,
  ComposerHorizontalRule,
} from "@features/composer/lib/editor/blocks.js"
import {
  ComposerChipSelection,
  ComposerDocument,
  ComposerHistory,
  ComposerParagraph,
  ComposerText,
  CommandChipNode,
  FileMentionNode,
  type FileMentionOptions,
} from "@features/composer/lib/editor/chips.js"
import { ComposerListExtensions } from "@features/composer/lib/editor/lists.js"
import { ComposerMarkdownSource } from "@features/composer/lib/editor/markdown-source.js"
import {
  ComposerBold,
  ComposerCode,
  ComposerItalic,
  ComposerStrike,
} from "@features/composer/lib/editor/marks.js"
import { ComposerUndoGrouping } from "@features/composer/lib/editor/undo-grouping.js"

export function createComposerExtensions(options: FileMentionOptions = {}): Extensions {
  return [
    ComposerDocument,
    ComposerParagraph,
    ComposerText,
    ComposerHistory,
    ComposerUndoGrouping,
    FileMentionNode.configure(options),
    CommandChipNode,
    ComposerChipSelection,
    ComposerMarkdownSource,
    ComposerItalic,
    ComposerBold,
    ComposerStrike,
    ComposerCode,
    ComposerCodeBlock,
    ComposerBlockquote,
    ComposerHorizontalRule,
    ComposerHeading,
    ...ComposerListExtensions,
  ]
}
