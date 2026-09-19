import { afterEach, describe, expect, it } from "vitest"
import { effectScope, nextTick, ref } from "vue"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"

describe("useTranscriptExpand", () => {
  let scope: ReturnType<typeof effectScope>

  afterEach(() => {
    scope?.stop()
  })

  it("切走再切回保留展开，不串到别的会话", async () => {
    const sessionId = ref("s1")
    scope = effectScope()
    const expand = scope.run(() => useTranscriptExpand(sessionId))

    if (!expand) throw new Error("未创建 expand")
    expand.toggleExpand("row-a", true)
    sessionId.value = "s2"
    await nextTick()
    expect(expand.isExpand("row-a")).toBeUndefined()
    expand.toggleExpand("row-b", true)
    sessionId.value = "s1"
    await nextTick()
    expect(expand.isExpand("row-a")).toBe(true)
    expect(expand.isExpand("row-b")).toBeUndefined()
  })
})
