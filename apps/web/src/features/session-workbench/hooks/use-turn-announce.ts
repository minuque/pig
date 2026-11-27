import type { Ref } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { t } from "@i18n/index.js"
import { pushNotification } from "@pig/ui/notification"
import type { PanelHost } from "@features/panel-host/index.js"
import { sessionTitle, untitledSession } from "@features/session/index.js"
import { notifySystem } from "@features/settings/index.js"

interface TurnAnnounceDeps {
  sessionId: Ref<string | undefined>
  sessions: Ref<readonly SessionMetadata[]>
  host: PanelHost
  openSession(id: string): void
}

export function useTurnAnnounce(deps: TurnAnnounceDeps) {
  return function announce(kind: "done" | "error", message?: string) {
    const id = deps.sessionId.value

    if (!id) return
    const meta = deps.sessions.value.find((item) => item.id === id)
    const title = meta ? sessionTitle(meta) : untitledSession()
    const failed = kind === "error"
    const body = failed ? message || t("session.turnFailed") : t("views.turnDone")

    if (deps.host.routeAlert(id, kind) === "notification") {
      pushNotification({
        id: `turn:${id}`,
        title,
        body,
        tone: failed ? "error" : "success",
        keepUntilResolved: failed,
        sessionId: id,
        avatar: meta?.cwd ? { kind: "project", cwd: meta.cwd } : { kind: "brand" },
        actions: [
          {
            label: t("session.openSession"),
            primary: true,
            run: () => {
              if (deps.sessionId.value === id) deps.host.showView("chat")
              else deps.openSession(id)
            },
          },
        ],
      })
    }

    void notifySystem({
      title,
      body,
      onClick: () => deps.openSession(id),
    })
  }
}
