import { describe, expect, it } from "vitest"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"

describe("useComposerQueue", () => {
  it("按会话分桶：shiftFor/sizeFor 只动指定会话，当前桶不受影响", () => {
    const queue = useComposerQueue()

    queue.setKey("s1")
    queue.enqueue("一")
    queue.enqueue("二")
    queue.setKey("s2")
    queue.enqueue("别人的")

    expect(queue.sizeFor("s1")).toBe(2)
    const head = queue.shiftFor("s1")

    expect(head?.text).toBe("一")
    expect(queue.sizeFor("s1")).toBe(1)
    expect(queue.items.value.map((item) => item.text)).toEqual(["别人的"])
  })

  it("unshiftFor 把条目放回指定会话队首", () => {
    const queue = useComposerQueue()

    queue.setKey("s1")
    queue.enqueue("一")
    queue.enqueue("二")
    const head = queue.shiftFor("s1")

    if (!head) throw new Error("队首缺失")
    queue.unshiftFor("s1", head)

    expect(queue.sizeFor("s1")).toBe(2)
    expect(queue.shiftFor("s1")?.text).toBe("一")
  })

  it("没有那个会话的桶时长度为零，且不污染当前会话", () => {
    const queue = useComposerQueue()

    queue.setKey("s2")
    queue.enqueue("当前")

    expect(queue.sizeFor("s1")).toBe(0)
    expect(queue.shiftFor("s1")).toBeUndefined()
    expect(queue.items.value.map((item) => item.text)).toEqual(["当前"])
  })
})
