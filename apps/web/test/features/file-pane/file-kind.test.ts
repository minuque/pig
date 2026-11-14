import { describe, expect, it } from "vitest"
import { fileViewKind } from "@features/file-pane/lib/file-kind.js"

describe("文件按类型分流", () => {
  it("Markdown 默认渲染", () => {
    for (const path of ["README.md", "docs/a.MDX", "notes.markdown"])
      expect(fileViewKind(path)).toBe("markdown")
  })

  it("位图走图片", () => {
    for (const path of ["a.png", "b.JPG", "c.jpeg", "d.gif", "e.bmp", "f.webp", "g.avif"])
      expect(fileViewKind(path)).toBe("image")
  })

  it("SVG 不当位图，其余按文本读", () => {
    for (const path of ["icon.svg", "main.ts", "Dockerfile", "a.png.txt"])
      expect(fileViewKind(path)).toBe("text")
  })
})
