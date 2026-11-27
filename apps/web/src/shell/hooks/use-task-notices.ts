import type { Ref } from "vue"
import type { SessionMetadata, Task, TaskStatus } from "@/types/common-type.js"
import { t } from "@i18n/index.js"
import { pushNotification } from "@pig/ui/notification"
import { sessionTitle, untitledSession } from "@features/session/index.js"
import { notifySystem } from "@features/settings/index.js"

interface TaskNoticeDeps {
  sessions: Ref<readonly SessionMetadata[]>
  activeSessionId: Ref<string | undefined>
  railTasksVisible: Ref<boolean>
  openTask(sessionId: string, taskId: string): void
}

export function useTaskNotices(deps: TaskNoticeDeps) {
  const known = new Map<string, Map<string, TaskStatus>>()

  return function onTasks(sessionId: string, tasks: readonly Task[]) {
    let prev = known.get(sessionId)

    if (!prev) {
      prev = new Map()
      for (const task of tasks) prev.set(task.id, task.status)
      known.set(sessionId, prev)
      return
    }

    for (const task of tasks) {
      const prevStatus = prev.get(task.id)
      prev.set(task.id, task.status)

      if (prevStatus !== "queued" && prevStatus !== "running") continue

      if (task.status !== "completed" && task.status !== "failed") continue

      if (sessionId === deps.activeSessionId.value && deps.railTasksVisible.value) continue

      const meta = deps.sessions.value.find((item) => item.id === sessionId)
      const failed = task.status === "failed"
      const title = t(failed ? "rail.taskFailed" : "rail.taskCompleted")
      const body = failed && task.error ? `${task.description}: ${task.error}` : task.description

      pushNotification({
        id: `task:${sessionId}:${task.id}`,
        title,
        body,
        tone: failed ? "error" : "success",
        keepUntilResolved: failed,
        sessionId,
        avatar: meta?.cwd ? { kind: "project", cwd: meta.cwd } : { kind: "brand" },
        actions: [
          {
            label: t("rail.viewTask"),
            primary: true,
            run: () => deps.openTask(sessionId, task.id),
          },
        ],
      })

      void notifySystem({
        title,
        body: meta ? `${sessionTitle(meta)} · ${body}` : `${untitledSession()} · ${body}`,
        onClick: () => deps.openTask(sessionId, task.id),
      })
    }
  }
}
