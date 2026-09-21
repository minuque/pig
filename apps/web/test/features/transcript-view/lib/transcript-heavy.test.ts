import { describe, expect, it } from "vitest"
import type { TimelineRow } from "@features/transcript-view/type.js"
import {
  canUpgradeHeavy,
  pickHeavyUpgrades,
  streamingIds,
} from "@features/transcript-view/lib/transcript-heavy.js"

function assistant(id: string, streaming = false): TimelineRow {
  return {
    id,
    role: "assistant",
    text: "答",
    streaming,
    error: false,
    aborted: false,
    timestamp: 0,
  }
}

function user(id: string): TimelineRow {
  return { id, role: "user", text: "问", images: [], timestamp: 0 }
}

function state(input: { heavy?: readonly string[]; immediate?: readonly string[]; idle: boolean }) {
  return {
    heavy: new Set(input.heavy ?? []),
    immediate: new Set(input.immediate ?? []),
    idle: input.idle,
  }
}

describe("打开已有会话 → 滚动中保持纯文本、停稳后逐帧补齐 Markdown", () => {
  it("助手行才分轻重，用户行和工具行不进队列", () => {
    expect(canUpgradeHeavy({ id: "a", role: "assistant", streaming: false })).toBe(true)
    expect(canUpgradeHeavy({ id: "a", role: "assistant", streaming: true })).toBe(false)
    expect(canUpgradeHeavy(user("u"))).toBe(false)
  })

  it("滚动中不补齐未点名的行，停稳后按窗口顺序每帧给上限个", () => {
    const rows = [assistant("a1"), assistant("a2"), assistant("a3")]
    const scrolling = state({ idle: false })

    expect(pickHeavyUpgrades(rows, scrolling)).toEqual([])
    expect(pickHeavyUpgrades(rows, state({ idle: true }), 2)).toEqual(["a1", "a2"])
    expect(pickHeavyUpgrades(rows, state({ heavy: ["a1"], idle: true }), 2)).toEqual(["a2", "a3"])
  })

  it("已升级的助手行不再进队列，默认每帧只升一行", () => {
    const rows = [assistant("a1"), assistant("a2"), assistant("a3")]

    expect(pickHeavyUpgrades(rows, state({ heavy: ["a1", "a2"], idle: true }))).toEqual(["a3"])
    expect(pickHeavyUpgrades(rows, state({ idle: true }))).toEqual(["a1"])
    expect(pickHeavyUpgrades(rows, state({ idle: true }), 0)).toEqual([])
  })

  it("点名行（展开、跳转）滚动中也立刻升级", () => {
    const rows = [assistant("a1"), assistant("a2")]

    expect(pickHeavyUpgrades(rows, state({ immediate: ["a2"], idle: false }), 1)).toEqual(["a2"])
  })

  it("流式行始终重渲染，且不占每帧额度", () => {
    const rows = [assistant("live", true), assistant("a1"), assistant("a2")]

    expect(streamingIds(rows)).toEqual(["live"])
    expect(pickHeavyUpgrades(rows, state({ idle: true }), 2)).toEqual(["a1", "a2"])
  })
})
