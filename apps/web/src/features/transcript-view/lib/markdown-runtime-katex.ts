import "katex/dist/katex.min.css"
import katexAms from "katex/dist/fonts/KaTeX_AMS-Regular.woff2?url"
import katexMain from "katex/dist/fonts/KaTeX_Main-Regular.woff2?url"
import katexMath from "katex/dist/fonts/KaTeX_Math-Italic.woff2?url"
import katexSize1 from "katex/dist/fonts/KaTeX_Size1-Regular.woff2?url"
import katexSize2 from "katex/dist/fonts/KaTeX_Size2-Regular.woff2?url"
import { setKaTeXWorker } from "markstream-vue"
import KatexWorker from "markstream-vue/workers/katexRenderer.worker?worker&inline"

const KATEX_FONT_URLS = [katexMain, katexMath, katexSize1, katexSize2, katexAms]

export function installKatexRuntime() {
  for (const href of KATEX_FONT_URLS) {
    const link = document.createElement("link")
    link.rel = "preload"
    link.as = "font"
    link.type = "font/woff2"
    link.crossOrigin = "anonymous"
    link.href = href
    document.head.appendChild(link)
  }
  setKaTeXWorker(new KatexWorker())
}
