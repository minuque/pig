import { describe, expect, it } from "vitest"
import { ancestors } from "@features/file-pane/lib/tree.js"

describe("文件树", () => {
  it("打开深层文件时依次展开它上面的每一级目录", () => {
    expect(ancestors("src/features/a.ts")).toEqual(["src", "src/features"])
    expect(ancestors("a.ts")).toEqual([])
  })
})
