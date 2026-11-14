import { describe, expect, it } from "vitest"
import { finishedWrites, locateLines, workspacePath } from "@features/file-pane/lib/paths.js"
import type { TranscriptItem } from "@/types/common-type.js"

describe("对话里的路径换成工作区内的文件", () => {
  it("相对路径原样保留，去掉 ./", () => {
    expect(workspacePath("C:/proj", "./docs/a.md")).toEqual({ path: "docs/a.md" })
    expect(workspacePath("/home/me/proj", "src\\main.ts")).toEqual({ path: "src/main.ts" })
  })

  it("工作区内的绝对路径换成相对，盘符大小写不敏感", () => {
    expect(workspacePath("C:/proj", "c:\\proj\\src\\a.ts")).toEqual({ path: "src/a.ts" })
    expect(workspacePath("/home/me/proj", "/home/me/proj/a.ts")).toEqual({ path: "a.ts" })
    expect(workspacePath("ssh://box/srv/app", "/srv/app/lib/x.py")).toEqual({ path: "lib/x.py" })
  })

  it("读出行号写法", () => {
    expect(workspacePath("/p", "a.ts#L12")).toEqual({ path: "a.ts", line: 12, endLine: 12 })
    expect(workspacePath("/p", "a.ts#L3-L9")).toEqual({ path: "a.ts", line: 3, endLine: 9 })
    expect(workspacePath("/p", "a.ts:40")).toEqual({ path: "a.ts", line: 40, endLine: 40 })
    expect(workspacePath("/p", "a.ts:40:2")).toEqual({ path: "a.ts", line: 40, endLine: 40 })
  })

  it("网址、锚点、工作区外和越界的路径不算", () => {
    for (const raw of [
      "https://x.dev/a.md",
      "mailto:a@b.c",
      "#intro",
      "comark:incomplete-link",
      "/etc/passwd",
      "../other/a.md",
      "",
    ])
      expect(workspacePath("/home/me/proj", raw)).toBeUndefined()
  })

  it("链接里的百分号编码先解码", () => {
    expect(workspacePath("/p", "docs/my%20notes.md")).toEqual({ path: "docs/my notes.md" })
  })
})

describe("在文件里找改后的文本", () => {
  it("给出片段所在的行范围", () => {
    expect(locateLines("a\nb\nc\nd", "c\nd")).toEqual({ line: 3, endLine: 4 })
    expect(locateLines("a\nb", "zzz")).toBeUndefined()
    expect(locateLines("a\nb", "")).toBeUndefined()
  })
})

describe("agent 写完的文件", () => {
  const tool = (id: string, toolName: string, status: string, path: string) =>
    ({
      id,
      role: "tool",
      toolCallId: id,
      toolName,
      input: { path },
      content: [],
      timestamp: 0,
      status,
      isError: false,
    }) as unknown as TranscriptItem

  it("只算完成的编辑与写入", () => {
    const items = [
      tool("1", "edit", "complete", "/p/a.ts"),
      tool("2", "write", "running", "/p/b.ts"),
      tool("3", "read", "complete", "/p/c.ts"),
      tool("4", "write", "complete", "d.ts"),
    ]

    expect(finishedWrites("/p", items)).toEqual([
      { id: "1", path: "a.ts" },
      { id: "4", path: "d.ts" },
    ])
  })
})
