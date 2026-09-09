import DiffsWorker from "@pierre/diffs/worker/worker.js?worker"
import { getOrCreateWorkerPoolSingleton } from "@pierre/diffs/worker"
import {
  preloadCodeBlockRuntime,
  setKaTeXWorker,
  setMermaidWorker,
  setStreamDiffsWorkerPool,
} from "markstream-vue"
import KatexWorker from "markstream-vue/workers/katexRenderer.worker?worker&inline"
import MermaidWorker from "markstream-vue/workers/mermaidParser.worker?worker&inline"

/** 安装 KaTeX/Mermaid worker 与代码高亮线程池。 */
export function installMarkdownRuntime() {
  setMermaidWorker(new MermaidWorker())
  setKaTeXWorker(new KatexWorker())
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
  void preloadCodeBlockRuntime()
}
