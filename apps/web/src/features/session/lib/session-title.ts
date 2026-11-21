import type { SessionMetadata } from "@/types/common-type.js"
import { t } from "@i18n/index.js"

export function untitledSession(): string {
  return t("session.untitled")
}

export function sessionTitle(session: Pick<SessionMetadata, "sessionName">): string {
  const name = session.sessionName?.trim()
  return name || untitledSession()
}
