import DiffsWorker from "@pierre/diffs/worker/worker.js?worker"
import { getOrCreateWorkerPoolSingleton } from "@pierre/diffs/worker"
import katexAms from "katex/dist/fonts/KaTeX_AMS-Regular.woff2?url"
import katexMain from "katex/dist/fonts/KaTeX_Main-Regular.woff2?url"
import katexMath from "katex/dist/fonts/KaTeX_Math-Italic.woff2?url"
import katexSize1 from "katex/dist/fonts/KaTeX_Size1-Regular.woff2?url"
import katexSize2 from "katex/dist/fonts/KaTeX_Size2-Regular.woff2?url"
import {
  preloadCodeBlockRuntime,
  setKaTeXWorker,
  setMermaidWorker,
  setStreamDiffsWorkerPool,
} from "markstream-vue"
import KatexWorker from "markstream-vue/workers/katexRenderer.worker?worker&inline"
import MermaidWorker from "markstream-vue/workers/mermaidParser.worker?worker&inline"

const KATEX_FONT_URLS = [katexMain, katexMath, katexSize1, katexSize2, katexAms]

/** 公式字体进缓存，避免首屏 KaTeX 换字撑开。 */
function preloadKatexFonts() {
  for (const href of KATEX_FONT_URLS) {
    const link = document.createElement("link")
    link.rel = "preload"
    link.as = "font"
    link.type = "font/woff2"
    link.crossOrigin = "anonymous"
    link.href = href
    document.head.appendChild(link)
  }
}

/** 安装 KaTeX/Mermaid worker 与代码高亮线程池。 */
export function installMarkdownRuntime() {
  preloadKatexFonts()
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
