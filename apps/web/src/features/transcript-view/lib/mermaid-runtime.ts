import { enableMermaid } from "markstream-vue"

let runtimeStarted = false

async function loadMermaid(): Promise<unknown> {
  const pele = await import("pele/lazy")
  return {
    /** markstream-vue 用 parse 判可解析性；pele 的 parse 是同步的，
     *  需要先把对应 diagram 类型异步加载进来。 */
    parse: async (source: string) => {
      const type = pele.detectType(source)

      // pele 对未识别图型不抛错，不拦下来会白跑一轮渲染才进错误态。
      if (!type) throw new Error("unsupported-diagram")
      await pele.load(type)
      pele.parse(source)
      return true
    },
    /** markstream-vue 调用 render(id, source)，pele 用 source 渲染。 */
    render: async (id: string, source: string) => {
      const result = await pele.renderAsync(source, { idPrefix: id })
      return { svg: result.svg }
    },
  }
}

/** 第一次进 Transcript 再加载 pele，渲染走主线程，打包约 2.2MB。 */
export function ensureMermaidRuntime(): void {
  if (runtimeStarted) return
  runtimeStarted = true
  enableMermaid(loadMermaid)
}
