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

  it("move 按键重排，update 原地改文字并保留附件预览", () => {
    const queue = useComposerQueue()
    const preview = [
      {
        id: "f1",
        name: "shot.png",
        mimeType: "image/png",
        size: 3,
        url: "blob:1",
        file: new File([new Uint8Array(1)], "shot.png", { type: "image/png" }),
      },
    ]

    queue.setKey("s1")
    queue.enqueue("带图的一条", undefined, preview)
    queue.enqueue("第二条")
    queue.move(queue.items.value[1]!.id, -1)

    expect(queue.items.value.map((item) => item.text)).toEqual(["第二条", "带图的一条"])

    const target = queue.items.value[1]!

    queue.update({ id: target.id, text: "改过的文字" })

    expect(queue.items.value[1]!.text).toBe("改过的文字")
    expect(queue.items.value[1]!.attachmentsPreview).toEqual(preview)
  })

  it("欢迎页的队列交给刚建出的会话，欢迎页回到空", () => {
    const queue = useComposerQueue()

    queue.setKey(undefined)
    queue.enqueue("建会话时排的")
    queue.handOff("s1")

    expect(queue.items.value).toEqual([])
    queue.setKey("s1")
    expect(queue.items.value.map((item) => item.text)).toEqual(["建会话时排的"])
  })
})
