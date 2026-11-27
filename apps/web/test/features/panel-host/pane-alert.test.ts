import { describe, expect, it } from "vitest"
import { routeAlert } from "@features/panel-host/lib/pane-alert.js"

describe("提醒分工", () => {
  it("在对话里：回复完成与出错不弹，对话里看得到；扩展通知与别处更新走顶部 Toast", () => {
    expect(routeAlert("done", "chat")).toBe("none")
    expect(routeAlert("error", "chat")).toBe("none")
    expect(routeAlert("notify", "chat")).toBe("toast")
    expect(routeAlert("changed", "chat")).toBe("toast")
  })

  it("在文件视图：完成与出错走右上角 Notification，扩展通知走 Toast", () => {
    expect(routeAlert("done", "files")).toBe("notification")
    expect(routeAlert("error", "files")).toBe("notification")
    expect(routeAlert("notify", "files")).toBe("toast")
  })

  it("会话不在当前 pane 里：出错与扩展通知走 Notification，完成交给后台泵队不重复", () => {
    expect(routeAlert("error", undefined)).toBe("notification")
    expect(routeAlert("notify", undefined)).toBe("notification")
    expect(routeAlert("done", undefined)).toBe("none")
    expect(routeAlert("changed", undefined)).toBe("toast")
  })
})
