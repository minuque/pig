import { computed } from "vue"
import { useExtensionUi } from "@features/extension-ui/index.js"
import { useSession } from "@features/session/index.js"
import { latestToolTasks } from "@features/transcript-view/index.js"
import { useSessionRail } from "@features/session-rail/index.js"
import { mergeTasks, visibleSections } from "@features/session-rail/lib/task-list.js"
import { useTaskStopping } from "@features/session-rail/hooks/use-task-stopping.js"

/** 摘要卡片的数据：常驻面板与窄屏浮层共用。 */
export function useRailCards() {
  const session = useSession()
  const ui = useExtensionUi()
  const rail = useSessionRail()!
  const tasks = computed(() =>
    mergeTasks(session.tasks.value, latestToolTasks(session.transcript.value)),
  )
  /** 进行中与已结束两段；清除过的已结束任务不显示，又跑起来时照常显示。 */
  const sections = computed(() => visibleSections(tasks.value, rail.dismissed.value))
  const runningCount = computed(
    () => tasks.value.filter((task) => task.status === "running").length,
  )
  // 只有后台任务能停：前台工具里的任务随工具调用结束
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
