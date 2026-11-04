import { describe, expect, it } from "vitest"
import {
  ACCENT_ATTR,
  ACCENT_STORAGE_KEY,
  GRAY_ATTR,
  paintAccent,
  readStoredAccent,
} from "@features/theme/lib/palette.js"
import { DEFAULT_ACCENT_ID, findAccent } from "@features/theme/lib/accents.js"

function target() {
  const attrs = new Map<string, string>()
  const state = { json: null as string | null }
  return {
    attrs,
    get json() {
      return state.json
    },
    setAttr: (name: string, value: string | null) => {
      if (value) attrs.set(name, value)
      else attrs.delete(name)
    },
    store: (json: string | null) => {
      state.json = json
    },
  }
}

describe("paintAccent", () => {
  it("写 data-accent-color 与对应的中性色族，并缓存选择", () => {
    const painted = target()
    paintAccent(painted, "teal")

    expect(painted.attrs.get(ACCENT_ATTR)).toBe("teal")
    expect(painted.attrs.get(GRAY_ATTR)).toBe(findAccent("teal").gray)
    expect(JSON.parse(painted.json ?? "")).toEqual({ id: "teal" })
  })

  it("传 null 回到默认 accent 并清掉缓存", () => {
    const painted = target()
    paintAccent(painted, "red")
    paintAccent(painted, null)

    expect(painted.attrs.get(ACCENT_ATTR)).toBe(DEFAULT_ACCENT_ID)
    expect(painted.attrs.get(GRAY_ATTR)).toBe(findAccent(DEFAULT_ACCENT_ID).gray)
    expect(painted.json).toBeNull()
  })
})

describe("readStoredAccent", () => {
  it("读出存储的 accent id", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "blue" }))

    expect(readStoredAccent()).toBe("blue")
  })

  it("已下线的 accent 与非法 id 都返回 null", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "iris" }))
    expect(readStoredAccent()).toBeNull()

    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "nope" }))
    expect(readStoredAccent()).toBeNull()
  })
})
