import { defineComponent, h } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import {
  useComposerQueue,
  type ComposerQueueApi,
} from "@features/composer/hooks/use-composer-queue.js"
import {
  createSharedBuckets,
  provideSharedBuckets,
  useSessionBuckets,
} from "@features/composer/hooks/use-session-buckets.js"

function twoSides() {
  const store = createSharedBuckets()
  const side = () => useSessionBuckets(() => ({ items: [] as string[] }), undefined, "queue", store)
  return { left: side(), right: side() }
}

describe("两侧共用的按会话暂存", () => {
  it("两侧都在新会话页时各用各的暂存", () => {
    const { left, right } = twoSides()

    left.current().items.push("左侧附件")

    expect(right.current().items).toEqual([])
  })

  it("新会话页的暂存交给新会话后，另一侧打开这个会话也拿得到", () => {
    const { left, right } = twoSides()

    left.current().items.push("待发")
    left.handOff("s1")
    right.setKey("s1")

    expect(right.current().items).toEqual(["待发"])
    expect(left.forKey(undefined).items).toEqual([])
  })

  it("壳层用 provideSharedBuckets 返回的桶建队列时，与子面板 inject 到的是同一份", () => {
    let shellQueue!: ComposerQueueApi
    let childQueue!: ComposerQueueApi
    const Child = defineComponent({
      setup() {
        childQueue = useComposerQueue()
        return () => null
      },
    })
    const Shell = defineComponent({
      setup() {
        const buckets = provideSharedBuckets()
        shellQueue = useComposerQueue(buckets)
        return () => h(Child)
      },
    })
    const wrapper = mount(Shell)

    childQueue.setKey("s1")
    childQueue.enqueue("后台待发")

    expect(shellQueue.shiftFor("s1")?.text).toBe("后台待发")
    expect(childQueue.sizeFor("s1")).toBe(0)
    wrapper.unmount()
  })
})
