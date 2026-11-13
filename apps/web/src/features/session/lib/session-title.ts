import type { SessionMetadata } from "@/types/common-type.js"
import { t } from "@i18n/index.js"

/** 未命名 Session 的列表/标题回退文案。 */
export function untitledSession(): string {
  return t("session.untitled")
}

/** 列表标题：Pi sessionName，否则「新会话」。 */
export function sessionTitle(session: Pick<SessionMetadata, "sessionName">): string {
  const name = session.sessionName?.trim()
  return name || untitledSession()
}
