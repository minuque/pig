import { describe, expect, it } from "vitest"
import { routeAlert } from "@features/panel-host/lib/pane-alert.js"

describe("提醒分工", () => {
  it("在对话里：回复完成与出错不弹，对话里看得到；扩展通知与别处更新弹在岛上", () => {
    expect(routeAlert("done", "chat")).toBe("none")
    expect(routeAlert("error", "chat")).toBe("none")
    expect(routeAlert("notify", "chat")).toBe("island")
    expect(routeAlert("changed", "chat")).toBe("island")
  })

  it("在其他视图：当前会话的事一律弹在岛上", () => {
    expect(routeAlert("done", "files")).toBe("island")
    expect(routeAlert("error", "files")).toBe("island")
  })

  it("会话不在当前 pane 里：走 toast；回复完成交给后台通知，不重复", () => {
    expect(routeAlert("error", undefined)).toBe("toast")
    expect(routeAlert("notify", undefined)).toBe("toast")
    expect(routeAlert("done", undefined)).toBe("none")
  })
})
