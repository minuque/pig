import { ref } from "vue"
import { notify } from "@components/layout/notify.js"
import { t } from "@i18n/index.js"

export function useTaskStopping(stop: (taskId: string) => Promise<void>) {
  const stopping = ref<ReadonlySet<string>>(new Set())

  async function stopTask(taskId: string) {
    stopping.value = new Set(stopping.value).add(taskId)

    try {
      await stop(taskId)
    } catch {
      const next = new Set(stopping.value)
      next.delete(taskId)
      stopping.value = next
      notify(t("rail.stopFailed"), "error")
    }
  }

  return { stopping, stopTask }
}
