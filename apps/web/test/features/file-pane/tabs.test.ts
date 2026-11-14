import { describe, expect, it } from "vitest"
import {
  closeTab,
  emptyTabs,
  openTab,
  pinTab,
  readSessionTabs,
  writeSessionTabs,
} from "@features/file-pane/lib/tabs.js"

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe("文件标签", () => {
  it("单击打开的临时标签会被下一次单击替换", () => {
    const first = openTab(emptyTabs(), "a.ts", false)
    const second = openTab(first, "b.ts", false)

    expect(second).toEqual({ tabs: [{ path: "b.ts", preview: true }], active: "b.ts" })
  })

  it("固定的标签不会被替换", () => {
    const pinned = pinTab(openTab(emptyTabs(), "a.ts", false), "a.ts")
    const next = openTab(pinned, "b.ts", false)

    expect(next.tabs).toEqual([
      { path: "a.ts", preview: false },
      { path: "b.ts", preview: true },
    ])
  })

  it("再次打开已开的文件只激活，固定打开会转为固定", () => {
    let state = openTab(emptyTabs(), "a.ts", true)
    state = openTab(state, "b.ts", false)
    state = openTab(state, "a.ts", false)

    expect(state.active).toBe("a.ts")
    expect(state.tabs).toHaveLength(2)
    expect(openTab(state, "b.ts", true).tabs[1]).toEqual({ path: "b.ts", preview: false })
  })

  it("关掉当前标签时激活右边一个，最右的则激活左边", () => {
    let state = emptyTabs()

    for (const path of ["a.ts", "b.ts", "c.ts"]) state = openTab(state, path, true)

    expect(closeTab({ ...state, active: "b.ts" }, "b.ts").active).toBe("c.ts")
    expect(closeTab(state, "c.ts").active).toBe("b.ts")
    expect(closeTab(openTab(emptyTabs(), "a.ts", true), "a.ts")).toEqual(emptyTabs())
  })

  it("按会话记住标签，切回会话时恢复", () => {
    const storage = memoryStorage()
    const one = openTab(emptyTabs(), "a.ts", true)
    const two = openTab(emptyTabs(), "b.ts", false)

    writeSessionTabs("s1", one, storage)
    writeSessionTabs("s2", two, storage)

    expect(readSessionTabs("s1", storage)).toEqual(one)
    expect(readSessionTabs("s2", storage)).toEqual(two)
    expect(readSessionTabs("s3", storage)).toEqual(emptyTabs())
  })

  it("存储损坏时当作没有标签", () => {
    const storage = memoryStorage()
    storage.setItem("pig.files.tabs", "{broken")

    expect(readSessionTabs("s1", storage)).toEqual(emptyTabs())
  })
})
