import { computed, shallowRef } from "vue"
import { listEnvironments } from "@client/platform.js"
import { useExtensionUi } from "@features/extension-ui/index.js"
import { useSession } from "@features/session/index.js"
import { latestToolTasks } from "@features/transcript-view/index.js"
import { useSessionRail } from "@features/session-rail/index.js"
import { mergeTasks, visibleSections } from "@features/session-rail/lib/task-list.js"
import { useTaskStopping } from "@features/session-rail/hooks/use-task-stopping.js"

const localHost = shallowRef<string>()
let localHostAsked = false

function loadLocalHost() {
  if (localHostAsked) return
  localHostAsked = true
  listEnvironments()
    .then((list) => (localHost.value = list.find((item) => item.kind === "local")?.host))
    .catch(() => (localHostAsked = false))
}

export function useRailCards() {
  const session = useSession()
  const ui = useExtensionUi()
  const rail = useSessionRail()!
  const tasks = computed(() =>
    mergeTasks(session.tasks.value, latestToolTasks(session.transcript.value)),
  )
  const sections = computed(() => visibleSections(tasks.value, rail.dismissed.value))
  const stoppable = computed(
    () =>
      new Set(
        session.tasks.value
          .filter((task) => task.status === "running" || task.status === "queued")
          .map((task) => task.id),
      ),
  )
  const { stopping, stopTask } = useTaskStopping((taskId) => session.stopTask(taskId))
  loadLocalHost()

  const cards = computed(() => {
    const model = session.projection.value?.model
    const id = session.sessionId.value
    return {
      sessionId: id,
      cwd: session.sessionCwd.value,
      localHost: localHost.value,
      model,
      usage: session.contextUsage.value,
      sections: sections.value,
      stoppable: stoppable.value,
      stopping: stopping.value,
      statuses: id ? ui.statuses.value.get(id) : undefined,
    }
  })
  return { session, tasks, sections, cards, stopTask }
}
