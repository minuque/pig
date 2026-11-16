import { describe, expect, it } from "vitest"
import {
  PANEL_MIN_HEIGHT,
  closePanel,
  openPanel,
  visiblePanels,
} from "@features/split-view/lib/panel-stack.js"

describe("面板列", () => {
  it("按打开顺序追加在最下面", () => {
    expect(openPanel(openPanel([], "files"), "tasks")).toEqual(["files", "tasks"])
  })

  it("已开着的面板再打开不改顺序", () => {
    expect(openPanel(["files", "tasks"], "files")).toEqual(["files", "tasks"])
  })

  it("关闭只拿掉那一个", () => {
    expect(closePanel(["files", "tasks"], "files")).toEqual(["tasks"])
  })

  it("高度不够时最早打开的先收起", () => {
    expect(visiblePanels(["files", "tasks"], PANEL_MIN_HEIGHT * 2)).toEqual(["files", "tasks"])
    expect(visiblePanels(["files", "tasks"], PANEL_MIN_HEIGHT * 2 - 1)).toEqual(["tasks"])
  })

  it("再矮也保留最后打开的那个", () => {
    expect(visiblePanels(["files", "tasks"], 10)).toEqual(["tasks"])
  })
})
