import { describe, expect, it } from "vitest"
import { ancestors, gitMarks } from "@features/file-pane/lib/tree.js"

describe("文件树", () => {
  it("打开深层文件时依次展开它上面的每一级目录", () => {
    expect(ancestors("src/features/a.ts")).toEqual(["src", "src/features"])
    expect(ancestors("a.ts")).toEqual([])
  })

  it("改动的文件带状态字母，上级目录只标出里面有改动", () => {
    const marks = gitMarks([
      { path: "src/lib/a.ts", status: "M" },
      { path: "README.md", status: "U" },
    ])

    expect(marks.get("src/lib/a.ts")).toBe("M")
    expect(marks.get("README.md")).toBe("U")
    expect(marks.get("src")).toBe("dir")
    expect(marks.get("src/lib")).toBe("dir")
    expect(marks.has("docs")).toBe(false)
  })
})
