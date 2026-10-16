import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { computed, ref } from "vue"
import { useSessionTabs } from "@features/session-workbench/hooks/use-session-tabs.js"

const store = new Map<string, string>()

describe("useSessionTabs", () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function setup(route: string | undefined, ids: string[]) {
    store.set("pig.openSessionTabs", JSON.stringify(ids))
    const routeSessionId = ref(route)
    const open = vi.fn()
    const close = vi.fn()
    const tabs = useSessionTabs({
      activeSessionId: routeSessionId,
      routeSessionId,
      sessions: computed(() => ids.map((id) => ({ id, title: id }))),
      open,
      close,
    })
    return { routeSessionId, open, close, ...tabs }
  }

  it("关掉当前页签后打开右侧页签", () => {
    const tabs = setup("b", ["a", "b", "c"])
    tabs.closeTab("b")
    expect(tabs.open).toHaveBeenCalledWith("c")
    expect(tabs.close).not.toHaveBeenCalled()
  })

  it("关掉最后一个页签时回欢迎页", () => {
    const tabs = setup("a", ["a"])
    tabs.closeTab("a")
    expect(tabs.close).toHaveBeenCalledTimes(1)
    expect(tabs.open).not.toHaveBeenCalled()
  })

  it("关掉其余页签后，路由还停在被关页签上时切到留下的页签", () => {
    const tabs = setup("b", ["a", "b"])
    tabs.closeScope("a", "others")
    expect(tabs.open).toHaveBeenCalledWith("a")
    expect(tabs.close).not.toHaveBeenCalled()
  })
})
