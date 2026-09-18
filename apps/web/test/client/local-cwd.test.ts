import { afterEach, describe, expect, it } from "vitest"
import {
  LAST_CWD_KEY,
  LOCAL_WORKSPACES_KEY,
  loadLastCwd,
  loadLocalWorkspaces,
  parseLocalWorkspaces,
  saveLastCwd,
  saveLocalWorkspaces,
  type WorkspaceStorage,
} from "@client/local-cwd.js"

const STORAGE = new Map<string, string>()
const storage: WorkspaceStorage = {
  getItem: (key) => STORAGE.get(key) ?? null,
  setItem: (key, value) => void STORAGE.set(key, value),
}

afterEach(() => {
  STORAGE.clear()
})

describe("local workspace preference persistence", () => {
  it("读写工作区列表和 last cwd，并规范化旧 Windows 路径", () => {
    expect(parseLocalWorkspaces('["/a/", "", 42, "C:\\\\Foo\\\\"]')).toEqual(["/a", "c:/foo"])
    expect(parseLocalWorkspaces('["G:\\\\AICode\\\\pig","g:/aicode/pig"]')).toEqual([
      "g:/aicode/pig",
    ])
    saveLocalWorkspaces(["/a", "/b"], storage)
    saveLastCwd("/a", storage)
    expect(STORAGE.get(LOCAL_WORKSPACES_KEY)).toBe('["/a","/b"]')
    expect(loadLocalWorkspaces(storage)).toEqual(["/a", "/b"])
    expect(loadLastCwd(storage)).toBe("/a")
  })

  it("失败路径：缺失或损坏的存储值当作空列表", () => {
    expect(parseLocalWorkspaces(null)).toEqual([])
    expect(parseLocalWorkspaces("not-json")).toEqual([])
    STORAGE.set(LOCAL_WORKSPACES_KEY, "{broken")
    STORAGE.set(LAST_CWD_KEY, "x")
    expect(loadLocalWorkspaces(storage)).toEqual([])
  })
})
