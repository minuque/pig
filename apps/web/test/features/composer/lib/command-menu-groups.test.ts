import { describe, expect, it } from "vitest"
import { buildCommandGroups, chipForRow } from "@features/composer/lib/command-menu-groups.js"

const label = (key: string) => key
const sessions = Array.from({ length: 7 }, (_, index) => ({
  id: `s${index}`,
  title: `会话 ${index}`,
  project: "pig",
}))

describe("@ 菜单里的历史会话", () => {
  it("会话组排在文件组前面，最多列 5 条", () => {
    const groups = buildCommandGroups({
      kind: "mention",
      query: "",
      clearApplicable: false,
      files: [{ path: "src/a.ts", kind: "file" }],
      sessions,
      skills: [],
      prompts: [],
      label,
    })

    expect(groups.map((group) => group.id)).toEqual(["sessions", "files"])
    expect(groups[0]?.rows.map((row) => row.title)).toEqual([
      "会话 0",
      "会话 1",
      "会话 2",
      "会话 3",
      "会话 4",
    ])
    expect(groups[0]?.rows[0]?.secondary).toBe("pig")
  })

  it("选中会话行插入指向该会话的引用 chip", () => {
    const [group] = buildCommandGroups({
      kind: "mention",
      query: "",
      clearApplicable: false,
      files: [],
      sessions: sessions.slice(0, 1),
      skills: [],
      prompts: [],
      label,
    })
    const row = group?.rows[0]

    expect(row && chipForRow(row, 3, 4)).toEqual({
      kind: "session",
      sessionId: "s0",
      label: "会话 0",
      start: 3,
      triggerLength: 4,
    })
  })
})
