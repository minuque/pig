import { describe, expect, it } from "vitest"
import {
  fileLinkLabel,
  inlineCodeFilePath,
  isFileLinkLabel,
} from "@features/transcript-view/lib/file-link.js"

describe("行内代码里的路径识别成文件", () => {
  it.each([
    ["src\\main.ts", "src/main.ts"],
    ["allocator.cc:217", "allocator.cc:217"],
    ["src/http.ts:42-64", "src/http.ts:42-64"],
    ["http.ts:42-64", "http.ts:42-64"],
    ["share/man/ls.1", "share/man/ls.1"],
    ["docker/Dockerfile", "docker/Dockerfile"],
    ["docs/README:12", "docs/README:12"],
    ["./bin/run:12", "./bin/run:12"],
    ["src/資料.備份:12", "src/資料.備份:12"],
    ["C:\\proj\\src\\a.ts", "C:\\proj\\src\\a.ts"],
    ["/Users/me/Path Test/notes with spaces.md", "/Users/me/Path Test/notes with spaces.md"],
  ])("%s 是文件", (code, path) => {
    expect(inlineCodeFilePath(code)).toBe(path)
  })

  it.each([
    "origin/main",
    "z-ai/glm-5.3",
    "src/main.ts/",
    "src/.../main.ts",
    "~/projects/…/notes.md",
    "I/W217:220",
    "bin/run:12",
    "github.com/owner/repo",
    "localhost:3000",
    "pnpm test",
    "cd /tmp && ls",
    "/usr/local/bin/node server.js",
    "package.json",
    "./patches/",
    "G:/tmp/backup/",
    "subagent-notification:377",
  ])("%s 不是文件", (code) => {
    expect(inlineCodeFilePath(code)).toBeNull()
  })
})

describe("文件链接只显示文件名与行号", () => {
  it.each([
    ["apps/web/src/main.ts", "main.ts"],
    ["src/http.ts:42", "http.ts · L42"],
    ["src/http.ts:42-64", "http.ts · L42–64"],
    ["src/http.ts:42:7", "http.ts · L42:C7"],
    ["docs/a.md#L3-L9", "a.md · L3–9"],
  ])("%s → %s", (raw, label) => {
    expect(fileLinkLabel(raw)).toBe(label)
  })
})

describe("markdown 文件链接的文字是路径时只显示文件，描述性文字保留", () => {
  it.each([
    ["src/example.ts:12", "src/example.ts:12", true],
    ["example.ts:12", "/repo/src/example.ts:12", true],
    ["example.ts:12-20", "/repo/src/example.ts:12-20", true],
    ["", "src/a.ts", true],
    ["validates the input", "/repo/src/example.ts:12", false],
    ["example.ts:99", "/repo/src/example.ts:12", false],
    ["example.ts:12-20", "/repo/src/example.ts:12", false],
  ])("%s → %s", (label, href, expected) => {
    expect(isFileLinkLabel(label, href)).toBe(expected)
  })
})
