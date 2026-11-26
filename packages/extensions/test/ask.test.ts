import { describe, expect, it } from "vitest"
import ask, { ASK_TOOL } from "../src/ask/index.ts"

type Tool = { name: string; execute(id: string, params: unknown): Promise<{ terminate?: boolean }> }

describe("ask 工具", () => {
  it("调用后本轮结束，回答由下一条用户消息带回", async () => {
    const tools: Tool[] = []
    ask({ registerTool: (tool: Tool) => tools.push(tool) } as never)
    const tool = tools.find((item) => item.name === ASK_TOOL)!
    const result = await tool.execute("call-1", {
      questions: [{ question: "用哪个库？", header: "库", options: [] }],
    })

    expect(result.terminate).toBe(true)
  })
})
