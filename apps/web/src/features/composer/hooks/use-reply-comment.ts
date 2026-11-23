import { computed, nextTick, provide, shallowRef, type Ref } from "vue"
import type { Editor } from "@tiptap/core"
import type { Side } from "@ui-sdk/core"
import { replyReference, type ReplyReference } from "@pig/protocol"
import { composerChipActionsKey } from "@features/composer/lib/editor/chip-actions.js"
import {
  findReplyChipPos,
  focusAfterReplyChip,
  insertReplyChipAtCaret,
  removeReplyChip,
  updateReplyChipComment,
  type InsertedSpaces,
} from "@features/composer/lib/editor/reply-citation.js"
import type { ReplyInsertRequest } from "@features/composer/type.js"

export interface ActiveReplyEdit {
  citeId: string
  reference: ReplyReference
  anchor: HTMLElement
  side: Side
  removeOnCancel: InsertedSpaces | null
}

export interface UseReplyCommentOptions {
  editor: Ref<Editor | undefined>
  onOpenFile(path: string): void
  onJumpReply(target: { sessionId: string; entryId: string }): void
  onSubmit(): void
}

export function useReplyComment(options: UseReplyCommentOptions) {
  const activeEdit = shallowRef<ActiveReplyEdit | null>(null)
  const replyCommentOpen = computed(() => activeEdit.value !== null)

  provide(composerChipActionsKey, {
    editingCiteId: computed(() => activeEdit.value?.citeId ?? null),
    openFile: options.onOpenFile,
    jumpReply: options.onJumpReply,
    editReply: ({ citeId, reference, anchor }) => {
      activeEdit.value = {
        citeId,
        reference,
        anchor,
        side: "top",
        removeOnCancel: null,
      }
    },
  })

  function insertReply(request: ReplyInsertRequest) {
    const instance = options.editor.value

    if (!instance || instance.isDestroyed) return
    const reference = replyReference(request.sessionId, request.entryId, request.text)
    const inserted = insertReplyChipAtCaret(instance, reference)

    if (!inserted) return
    activeEdit.value = {
      citeId: inserted.citeId,
      reference,
      anchor: request.anchor,
      side: "bottom",
      removeOnCancel: inserted.insertedSpaces,
    }
  }

  function save(comment: string) {
    const current = activeEdit.value
    const instance = options.editor.value

    if (!current || !instance) return
    updateReplyChipComment(instance, current.citeId, comment)
    activeEdit.value = null
    focusAfterReplyChip(instance, current.citeId)
  }

  function autoSave(comment: string) {
    const current = activeEdit.value
    const instance = options.editor.value

    if (!current || !instance) return
    updateReplyChipComment(instance, current.citeId, comment)
    activeEdit.value = null
  }

  async function saveAndSend(comment: string) {
    const current = activeEdit.value
    const instance = options.editor.value

    if (!current || !instance) return
    updateReplyChipComment(instance, current.citeId, comment)
    activeEdit.value = null
    await nextTick()

    if (instance.isDestroyed) return
    options.onSubmit()
    instance.view.focus()
  }

  function cancel() {
    const current = activeEdit.value
    const instance = options.editor.value

    if (!current) return
    activeEdit.value = null

    if (!instance) return

    if (current.removeOnCancel) {
      removeReplyChip(instance, current.citeId, current.removeOnCancel)
      instance.view.focus()
    } else {
      focusAfterReplyChip(instance, current.citeId)
    }
  }

  function dismiss() {
    activeEdit.value = null
  }

  function syncActive() {
    const current = activeEdit.value
    const instance = options.editor.value

    if (!current) return

    if (
      !instance ||
      instance.isDestroyed ||
      !findReplyChipPos(instance.state.doc, current.citeId)
    ) {
      activeEdit.value = null
    }
  }

  return {
    activeEdit,
    replyCommentOpen,
    insertReply,
    save,
    autoSave,
    saveAndSend,
    cancel,
    dismiss,
    syncActive,
  }
}
