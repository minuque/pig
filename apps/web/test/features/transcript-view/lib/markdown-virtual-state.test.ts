import { describe, expect, it } from "vitest"
import type { MarkstreamVirtualState } from "markstream-vue"
import {
  saveMarkdownVirtualState,
  takeMarkdownVirtualState,
} from "@features/transcript-view/lib/markdown-virtual-state.js"

function state(key: string): MarkstreamVirtualState {
  return { sessionKey: key } as MarkstreamVirtualState
}

describe("打开已有会话 → 行重挂恢复 markdown 虚拟状态", () => {
  it("按会话 scope 分开存，行号相同也不串", () => {
    saveMarkdownVirtualState("s1", "text:a", state("s1/a"))
    saveMarkdownVirtualState("s2", "text:a", state("s2/a"))
    expect(takeMarkdownVirtualState("s1", "text:a")).toMatchObject({ sessionKey: "s1/a" })
    expect(takeMarkdownVirtualState("s2", "text:a")).toMatchObject({ sessionKey: "s2/a" })
    expect(takeMarkdownVirtualState("s3", "text:a")).toBeNull()
  })

  it("失败路径：行状态只留最近 30 条，最旧的先丢", () => {
    for (let index = 0; index < 31; index += 1) {
      saveMarkdownVirtualState("s4", `text:${index}`, state(`row-${index}`))
    }

    expect(takeMarkdownVirtualState("s4", "text:0")).toBeNull()
    expect(takeMarkdownVirtualState("s4", "text:30")).toMatchObject({ sessionKey: "row-30" })
  })

  it("会话表最多留 4 个，重访会提升到最近使用", () => {
    for (const scope of ["a", "b", "c", "d"]) {
      saveMarkdownVirtualState(scope, "text:1", state(scope))
    }

    expect(takeMarkdownVirtualState("a", "text:1")).toMatchObject({ sessionKey: "a" })
    saveMarkdownVirtualState("e", "text:1", state("e"))
    expect(takeMarkdownVirtualState("a", "text:1")).toMatchObject({ sessionKey: "a" })
    expect(takeMarkdownVirtualState("b", "text:1")).toBeNull()
    expect(takeMarkdownVirtualState("e", "text:1")).toMatchObject({ sessionKey: "e" })
  })
})
