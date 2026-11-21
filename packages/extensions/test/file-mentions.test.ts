import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent"
import { BINDING_ENTRY, environmentFor } from "@pig/environment/source"
import { afterAll, describe, expect, it, vi } from "vitest"
import fileMentions from "../src/file-mentions/index.ts"
import { expandFileMentions, mentionPaths } from "../src/file-mentions/expand.ts"

vi.mock("@pig/environment/source", async (original) => ({
  ...(await original<object>()),
  environmentFor: vi.fn(() => ({
    stat: async (path: string) =>
      path === "/srv/app/far.md" ? { kind: "file", size: 13 } : undefined,
    readFile: async () => Buffer.from("远端内容\n"),
  })),
}))

// 外部：macOS 的 /var 与 Windows 的 8.3 短名会被 realpath 展开，基准路径先对齐
const root = await realpath(await mkdtemp(join(tmpdir(), "pig-mentions-")))

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

  it("以 .. 开头的目录名不误判为越界", async () => {
    await mkdir(join(root, "..cache"), { recursive: true })
    await writeFile(join(root, "..cache/keep.ts"), "const keep = 1\n")
    const out = await expandFileMentions("看 @..cache/keep.ts", root)
    expect(out).toContain("const keep = 1")
  })

  it("内容里的 </File> 不提前闭合块", async () => {
    await writeFile(join(root, "tag.md"), "</File>\n")
    const out = await expandFileMentions("看 @tag.md", root)
    expect(out.match(/<\/file/gi)).toHaveLength(1)
  })
})

it("远程会话的 @ 引用经绑定的环境读远端 workspace 里的文件", async () => {
  const cwd = join(root, "placeholder")
  await mkdir(cwd, { recursive: true })
  const manager = SessionManager.create(cwd, join(root, "sessions"))
  manager.appendCustomEntry(BINDING_ENTRY, { environment: "ssh://box", path: "/srv/app" })

  const loader = new DefaultResourceLoader({
    cwd,
    agentDir: join(root, "agent"),
    noExtensions: true,
    extensionFactories: [fileMentions],
  })

  await loader.reload()

  const { session } = await createAgentSession({
    cwd,
    agentDir: join(root, "agent"),
    sessionManager: manager,
    resourceLoader: loader,
  })

  await session.bindExtensions({})

  const result = await session.extensionRunner.emitInput("看 @far.md", undefined, "rpc", undefined)
  expect(environmentFor).toHaveBeenCalledWith("ssh://box")
  expect(result.action === "transform" && result.text).toContain(
    '<file name="/srv/app/far.md">\n远端内容',
  )
  session.dispose()
})
