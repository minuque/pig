import type { InjectionKey, Ref } from "vue"
import type { ReplyReference } from "@pig/protocol"

export interface ComposerChipActions {
  editingCiteId: Readonly<Ref<string | null>>
  openFile(path: string): void
  jumpReply(target: { sessionId: string; entryId: string; text?: string | undefined }): void
  editReply(payload: { citeId: string; reference: ReplyReference; anchor: HTMLElement }): void
}

export const composerChipActionsKey: InjectionKey<ComposerChipActions> =
  Symbol("composer-chip-actions")
