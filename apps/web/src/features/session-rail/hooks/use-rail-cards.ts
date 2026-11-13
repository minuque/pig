import { computed } from "vue"
import { useExtensionUi } from "@features/extension-ui/index.js"
import { useSession } from "@features/session/index.js"
import { latestToolTasks } from "@features/transcript-view/index.js"
import { mergeTasks } from "@features/session-rail/lib/task-list.js"

/** 摘要卡片的数据：常驻面板与窄屏浮层共用。 */
export function useRailCards() {
  const session = useSession()
  const ui = useExtensionUi()
  const tasks = computed(() =>
    mergeTasks(session.tasks.value, latestToolTasks(session.transcript.value)),
  )
  const runningCount = computed(
    () => tasks.value.filter((task) => task.status === "running").length,
  )
  const cards = computed(() => {
    const model = session.projection.value?.model
    const id = session.sessionId.value
    return {
      sessionId: id,
      cwd: session.sessionCwd.value,
      model: model ? model.id : undefined,
      usage: session.contextUsage.value,
      tasks: tasks.value,
      statuses: id ? ui.statuses.value.get(id) : undefined,
    }
  })
  const stopTask = (taskId: string) => void session.stopTask(taskId)
  return { session, tasks, runningCount, cards, stopTask }
}
