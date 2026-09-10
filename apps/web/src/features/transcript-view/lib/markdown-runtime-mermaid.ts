import { setMermaidWorker } from "markstream-vue"
import MermaidWorker from "markstream-vue/workers/mermaidParser.worker?worker&inline"

export function installMermaidRuntime() {
  setMermaidWorker(new MermaidWorker())
}
