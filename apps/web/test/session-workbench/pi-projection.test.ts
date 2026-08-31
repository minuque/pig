import { describe, expect, it } from "vitest"
import { workbenchHeaderTitle } from "@features/session-workbench/lib/session-state.js"

describe("workbenchHeaderTitle", () => {
  it("列表名优先，缺席时回落 snapshot 名，无会话为空", () => {
    expect(
      workbenchHeaderTitle({
        sessionId: "s1",
        listed: [{ id: "s1", sessionName: "卸载插件" }],
        projectionName: "旧名字",
      }),
    ).toBe("卸载插件")
    expect(
      workbenchHeaderTitle({
        sessionId: "s1",
        listed: [],
        projectionName: "新会话",
      }),
    ).toBe("新会话")
    expect(
      workbenchHeaderTitle({
        sessionId: undefined,
        listed: [],
        projectionName: undefined,
      }),
    ).toBe("")
  })
})
