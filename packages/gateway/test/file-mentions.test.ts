import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { expandFileMentions, mentionPaths } from "../src/pi/file-mentions.js"

const root = await mkdtemp(join(tmpdir(), "pig-mentions-"))

await mkdir(join(root, "src"), { recursive: true })

await writeFile(join(root, "src/a.ts"), "const a = 1\n")

await writeFile(join(root, "with space.md"), "# 标题\n")

await writeFile(join(root, "empty.txt"), "")

afterAll(async () => {
  const { rm } = await import("node:fs/promises")
  await rm(root, { recursive: true, force: true })
})

describe("mentionPaths", () => {
  it("识别 token 级 @，含引号路径", () => {
    expect(mentionPaths('看下 @src/a.ts 和 @"with space.md"')).toEqual([
      "src/a.ts",
      "with space.md",
    ])
  })

  it("邮件、行内字符、绝对路径不算引用", () => {
    expect(mentionPaths("mail me at a@b.com 或 /etc/passwd")).toEqual([])
  })
})

describe("expandFileMentions", () => {
  it("存在的文件展开为 <file> 块", async () => {
    const out = await expandFileMentions("看下 @src/a.ts", root)
    expect(out).toContain("看下 @src/a.ts")
    expect(out).toContain(`<file name="${join(root, "src/a.ts")}">`)
    expect(out).toContain("const a = 1")
  })

  it("引号路径同样展开", async () => {
    const out = await expandFileMentions('@"/with space.md"', root)
    expect(out).toBe('@"/with space.md"')
  })

  it("引号路径按原 token 展开", async () => {
    const out = await expandFileMentions('读 @"with space.md"', root)
    expect(out).toContain("# 标题")
  })

  it("不存在或空文件保留原文不展开", async () => {
    const missing = await expandFileMentions("看 @nope.md", root)
    expect(missing).toBe("看 @nope.md")
    const empty = await expandFileMentions("看 @empty.txt", root)
    expect(empty).toBe("看 @empty.txt")
  })

  it("跳出 cwd 的路径不展开", async () => {
    const out = await expandFileMentions("读 @../outside.txt", root)
    expect(out).toBe("读 @../outside.txt")
  })
})
