import { useEventListener } from "@vueuse/core"
import type { MaybeRefOrGetter } from "vue"
import { t } from "@i18n/index.js"
import { notifyAction } from "@components/layout/notify.js"
import { SESSION_DROP_EVENT, type DroppedSession } from "@features/session-nav/index.js"
import { sessionReferenceFile } from "@features/session-workbench/lib/session-reference.js"

/** 侧栏会话拖进会话面板：转成 Markdown 附件挂到输入卡。 */
export function useSessionDrop(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  addFiles: (files: File[]) => void,
): void {
  useEventListener(target, SESSION_DROP_EVENT, (event: Event) => {
    const sessions = (event as CustomEvent<readonly DroppedSession[]>).detail

    void Promise.all(sessions.map(sessionReferenceFile))
      .then(addFiles)
      .catch(() => notifyAction(t("composer.sessionReferenceFailed")))
  })
}
