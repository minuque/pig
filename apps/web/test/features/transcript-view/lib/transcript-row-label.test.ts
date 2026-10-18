import { afterEach, describe, expect, it } from "vitest"
import { i18n } from "@i18n/index.js"
import {
  toolRowLabelParts,
  type ToolRowLabelPart,
} from "@features/transcript-view/lib/transcript-row-label.js"
import type { ToolGroupKey, ToolRow, ToolRowStep } from "@features/transcript-view/type.js"

const originalLocale = i18n.global.locale.value

afterEach(() => {
  i18n.global.locale.value = originalLocale
})

function group(key: ToolGroupKey, count: number): ToolRowStep {
  return {
    type: "tools",
    id: key,
    key,
    items: Array.from({ length: count }, (_, i) => ({
      id: `${key}${i}`,
      toolName: key,
      running: false,
      isError: false,
      input: {},
      outputText: "",
      outputImages: [],
    })),
  }
}

function thought(id: string): ToolRowStep {
  return { type: "thought", id, text: "", streaming: false, startedAt: 0, endedAt: 1000 }
}

function row(steps: ToolRowStep[], aborted = false): ToolRow {
  return {
    id: "row",
    role: "tools",
    mode: "done",
    turnStreaming: false,
    steps,
    aborted,
    error: false,
  }
}

function text(parts: ToolRowLabelPart[]): string {
  return parts
    .map((part) =>
      part.kind === "text" ? part.text : `${part.prefix} ${part.count} ${part.suffix}`,
    )
    .join(" · ")
}

describe("toolRowLabelParts", () => {
  it("英文单数用 One 文案，首词大写，顺序对齐 zeron", () => {
    i18n.global.locale.value = "en"

    const steps = [
      thought("thought"),
      group("command", 1),
      group("edit", 1),
      group("write", 1),
      group("read", 1),
      group("search", 1),
      group("tool", 1),
    ]

    expect(text(toolRowLabelParts(row(steps)))).toBe(
      [
        "Thought 1 time",
        "ran 1 command",
        "edited 1 file",
        "wrote 1 file",
        "read 1 file",
        "searched 1 time",
        "called 1 tool",
      ].join(" · "),
    )
  })

  it("英文复数保持原文案", () => {
    i18n.global.locale.value = "en"

    const steps = [
      thought("thought1"),
      thought("thought2"),
      ...(["command", "edit", "write", "read", "search", "tool"] as const).map((key) =>
        group(key, 2),
      ),
    ]

    expect(text(toolRowLabelParts(row(steps)))).toBe(
      [
        "Thought 2 rounds",
        "ran 2 commands",
        "edited 2 files",
        "wrote 2 files",
        "read 2 files",
        "searched 2 times",
        "called tools 2 times",
      ].join(" · "),
    )
  })

  it("中止时首段为 Stopped", () => {
    i18n.global.locale.value = "en"

    expect(text(toolRowLabelParts(row([group("read", 1)], true)))).toBe("Stopped · read 1 file")
  })

  it("中文不分单复数，大写不改变文字", () => {
    i18n.global.locale.value = "zh-CN"

    expect(
      text(toolRowLabelParts(row([thought("thought"), group("edit", 1), group("read", 1)]))),
    ).toBe("思考 1 轮 · 编辑 1 次文件 · 读 1 次文件")
  })
})
