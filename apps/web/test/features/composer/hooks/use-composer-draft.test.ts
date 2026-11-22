import { describe, expect, it } from "vitest"
import { useComposerDraft } from "@features/composer/hooks/use-composer-draft.js"

describe("useComposerDraft", () => {
  it("按会话隔离草稿与历史", () => {
    const draft = useComposerDraft()

    draft.setKey("s1")
    draft.pushHistory("旧提示")
    draft.text.value = "草稿"
    draft.historyPrev()

    expect(draft.text.value).toBe("旧提示")
    draft.setKey("s2")
    expect(draft.text.value).toBe("")
    draft.historyPrev()
    expect(draft.text.value).toBe("")

    draft.setKey("s1")
    expect(draft.text.value).toBe("旧提示")
    draft.historyNext()
    expect(draft.text.value).toBe("草稿")
  })

  it("保存排队条目后还原未发草稿", () => {
    const draft = useComposerDraft()

    draft.setKey("s1")
    draft.text.value = "还没发的话"
    draft.beginQueueEdit("q1", "排队的内容")

    expect(draft.editingQueueId.value).toBe("q1")
    expect(draft.text.value).toBe("排队的内容")
    expect(draft.commitQueueEdit()).toEqual({ id: "q1", text: "排队的内容" })
    expect(draft.editingQueueId.value).toBeNull()
    expect(draft.text.value).toBe("还没发的话")
  })

  it("取消编辑排队条目也还原未发草稿", () => {
    const draft = useComposerDraft()

    draft.setKey("s1")
    draft.text.value = "还没发的话"
    draft.beginQueueEdit("q1", "排队的内容")
    draft.text.value = "改了一半"
    draft.cancelQueueEdit()

    expect(draft.commitQueueEdit()).toBeUndefined()
    expect(draft.text.value).toBe("还没发的话")
    expect(draft.isEmpty.value).toBe(false)
  })

  it("改编另一条排队条目时沿用原草稿，切到新条目", () => {
    const draft = useComposerDraft()

    draft.setKey("s1")
    draft.text.value = "还没发的话"
    draft.beginQueueEdit("q1", "排队的第一条")
    draft.beginQueueEdit("q2", "排队的第二条")

    expect(draft.editingQueueId.value).toBe("q2")
    expect(draft.text.value).toBe("排队的第二条")
    expect(draft.stashedDraft.value).toBe("还没发的话")
    expect(draft.commitQueueEdit()).toEqual({ id: "q2", text: "排队的第二条" })
    expect(draft.text.value).toBe("还没发的话")
  })

  it("切换会话时结束编辑状态，旧会话的草稿留在原桶", () => {
    const draft = useComposerDraft()

    draft.setKey("s1")
    draft.text.value = "还没发的话"
    draft.beginQueueEdit("q1", "排队的内容")
    draft.setKey("s2")

    expect(draft.editingQueueId.value).toBeNull()
    expect(draft.text.value).toBe("")

    draft.setKey("s1")
    expect(draft.text.value).toBe("还没发的话")
  })
})
