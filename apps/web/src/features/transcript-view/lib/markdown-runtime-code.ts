import DiffsWorker from "@pierre/diffs/worker/worker.js?worker"
import { getOrCreateWorkerPoolSingleton } from "@pierre/diffs/worker"
import { preloadCodeBlockRuntime, setStreamDiffsWorkerPool } from "markstream-vue"

export async function installCodeRuntime() {
  const poolSize = Math.min(4, navigator.hardwareConcurrency || 2)
  setStreamDiffsWorkerPool(
    getOrCreateWorkerPoolSingleton({
      poolOptions: {
        poolSize,
        workerFactory: () => new DiffsWorker(),
      },
      highlighterOptions: {
        theme: { dark: "dark-plus", light: "light-plus" },
      },
    }),
  )
  await preloadCodeBlockRuntime()
}
