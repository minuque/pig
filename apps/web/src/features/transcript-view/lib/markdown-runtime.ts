import { enableKatex, enableMermaid } from "markstream-vue"

/** 官网默认：启用 KaTeX / Mermaid loader，缺块时库自己动态 import。 */
export function installMarkdownRuntime() {
  enableMermaid()
  enableKatex()
}
