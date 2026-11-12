import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent"
import { BINDING_ENTRY, prepareRemoteCwd } from "@pig/environment/source"
import { afterEach, beforeEach, expect, test } from "vitest"

import remoteWorkspace from "../src/remote-workspace/index.ts"

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pig-remote-"))
})

afterEach(() => rm(root, { recursive: true, force: true }))

async function open(cwd: string, manager: SessionManager) {
  const agentDir = join(root, "agent")
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    noExtensions: true,
    extensionFactories: [remoteWorkspace],
  })

  await loader.reload()

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    sessionManager: manager,
    resourceLoader: loader,
  })

  await session.bindExtensions({})
  return session
}

async function bash(session: Awaited<ReturnType<typeof open>>, command: string) {
  const result = await session
    .getToolDefinition("bash")!
    .execute("call-1", { command }, undefined, undefined, undefined as never)
  return (result.content[0] as { text: string }).text.trim()
}

// 本机环境当远端替身：远端目录与占位 cwd 是两个不同目录
test("会话绑定远程后 bash 在远端目录执行，远端 skills 生效；重开会话仍在远端", async () => {
  const remote = join(root, "remote").split(sep).join("/")
  await mkdir(join(root, "remote", ".pi", "skills", "hello"), { recursive: true })
  await writeFile(join(root, "remote", "marker.txt"), "在远端")
  await writeFile(
    join(root, "remote", ".pi", "skills", "hello", "SKILL.md"),
    "---\nname: hello\ndescription: 远端技能\n---\n打招呼。",
  )
  const binding = { environment: "local", path: remote }
  const cwd = await prepareRemoteCwd(binding, join(root, "cache"))
  // 与 gateway 建远程会话一样：先把绑定写进会话
  const manager = SessionManager.create(cwd, join(root, "sessions"))
  manager.appendCustomEntry(BINDING_ENTRY, binding)

  const first = await open(cwd, manager)
  expect(await bash(first, "cat marker.txt")).toBe("在远端")
  expect(first.resourceLoader.getSkills().skills.map((skill) => skill.name)).toContain("hello")

  // 会话首条助手消息后才落盘；补一条让文件写下来
  first.sessionManager.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: "好" }],
    provider: "test",
    model: "test",
    api: "openai-completions",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  })
  const file = first.sessionFile!
  first.dispose()

  const reopened = await open(cwd, SessionManager.open(file))
  expect(await bash(reopened, "cat marker.txt")).toBe("在远端")
  reopened.dispose()
})
