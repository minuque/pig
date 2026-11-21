import { computed } from "vue"
import { useExtensionUi } from "@features/extension-ui/index.js"
import { useSession } from "@features/session/index.js"
import { latestToolTasks } from "@features/transcript-view/index.js"
import { useSessionRail } from "@features/session-rail/index.js"
import { mergeTasks, visibleSections } from "@features/session-rail/lib/task-list.js"
import { useTaskStopping } from "@features/session-rail/hooks/use-task-stopping.js"

export function useRailCards() {
  const session = useSession()
  const ui = useExtensionUi()
  const rail = useSessionRail()!
  const tasks = computed(() =>
    mergeTasks(session.tasks.value, latestToolTasks(session.transcript.value)),
  )
  const sections = computed(() => visibleSections(tasks.value, rail.dismissed.value))
  const runningCount = computed(
    () => tasks.value.filter((task) => task.status === "running").length,
  )
  const stoppable = computed(
    () =>
      new Set(
        session.tasks.value
          .filter((task) => task.status === "running" || task.status === "queued")
          .map((task) => task.id),
      ),
  )
  const { stopping, stopTask } = useTaskStopping((taskId) => session.stopTask(taskId))
  const cards = computed(() => {
    const model = session.projection.value?.model
    const id = session.sessionId.value
    return {
      sessionId: id,
      cwd: session.sessionCwd.value,
      model: model ? model.id : undefined,
      usage: session.contextUsage.value,
      sections: sections.value,
      stoppable: stoppable.value,
      stopping: stopping.value,
      statuses: id ? ui.statuses.value.get(id) : undefined,
    }
  })
  return { session, tasks, sections, runningCount, cards, stopTask }
}
