import { beforeEach, describe, expect, it, vi } from "vitest"

const { enableMermaid } = vi.hoisted(() => ({ enableMermaid: vi.fn() }))

vi.mock("markstream-vue", () => ({ enableMermaid }))

describe("ensureMermaidRuntime", () => {
  beforeEach(() => {
    vi.resetModules()
    enableMermaid.mockClear()
  })

  it("反复调用只初始化一次", async () => {
    // resetModules 后重新求值，模块级 runtimeStarted 回到 false
    const { ensureMermaidRuntime } =
      await import("@features/transcript-view/lib/mermaid-runtime.js")

    ensureMermaidRuntime()
    ensureMermaidRuntime()

    expect(enableMermaid).toHaveBeenCalledTimes(1)
  })
})
