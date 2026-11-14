import { describe, expect, it } from "vitest"
import { parseDelimited } from "@features/file-pane/lib/csv.js"

describe("表格预览", () => {
  it("引号里的逗号、换行与双引号都留在同一格", () => {
    expect(parseDelimited('名字,备注\n"张, 三","第一行\n第二行"\n李四,"说 ""好"""\n', ",")).toEqual(
      [
        ["名字", "备注"],
        ["张, 三", "第一行\n第二行"],
        ["李四", '说 "好"'],
      ],
    )
  })

  it("TSV 按制表符分列，兼容 CRLF", () => {
    expect(parseDelimited("a\tb\r\n1\t2\r\n", "\t")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })
})
