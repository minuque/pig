import { ref } from "vue"
import { t } from "@i18n/index.js"

export function useTaskStopping(stop: (taskId: string) => Promise<void>) {
  const stopping = ref<ReadonlySet<string>>(new Set())
  const stopErrors = ref<ReadonlyMap<string, string>>(new Map())

  async function stopTask(taskId: string) {
    stopping.value = new Set(stopping.value).add(taskId)

    if (stopErrors.value.has(taskId)) {
      const cleared = new Map(stopErrors.value)
      cleared.delete(taskId)
      stopErrors.value = cleared
    }

    try {
      await stop(taskId)
    } catch {
      const next = new Set(stopping.value)
      next.delete(taskId)
      stopping.value = next

      const nextErrors = new Map(stopErrors.value)
      nextErrors.set(taskId, t("rail.stopFailed"))
      stopErrors.value = nextErrors
    }
  }

  return { stopping, stopErrors, stopTask }
}
