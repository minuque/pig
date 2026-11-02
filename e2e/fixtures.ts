import { test as base, expect, type Page } from "@playwright/test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import Gateway from "../packages/gateway/src/index.js"
import type { DirectoryPort } from "../packages/gateway/src/directory.js"
import { createFakeRuntime, type FakeProviderSpec } from "./fake-model-runtime.js"
import { prebuildComplexSession, prebuildFillerSessions } from "./prebuild-session.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const webRoot = join(root, "apps/web/dist")

/** 与 web canonicalizeWorkspacePath 对齐，供 localStorage 种子。 */
export function canonicalizeWorkspacePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "")
  return /^[a-zA-Z]:/.test(normalized) ? normalized.toLowerCase() : normalized
}

/** 种子 localStorage 定位工作区；reducedMotion 由调用方按需 emulate（bench 要切两档）。 */
export async function seedWorkspaces(page: Page, workspaceIds: readonly string[]) {
  await page.addInitScript(
    ({ ids }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify(ids))
      localStorage.setItem("pig.lastCwd", ids[0] ?? "")
      localStorage.setItem("npg-theme", "light")
    },
    { ids: workspaceIds },
  )
}

export async function seedWorkspace(page: Page, workspaceId: string) {
  await seedWorkspaces(page, [workspaceId])
}

/** DataTransfer 只能在页面里造，一次派发一个拖拽事件到 .session-panel。 */
export async function dragOntoPanel(page: Page, type: string, total = 2) {
  await page.locator(".session-panel").evaluate(
    (element, input) => {
      const data = new DataTransfer()

      for (let i = 0; i < input.total; i += 1) {
        const image = i === 1
        const name = image ? "shot.png" : i === 0 ? "note.md" : `f${i}.txt`

        data.items.add(new File(["x"], name, { type: image ? "image/png" : "text/plain" }))
      }

      element.dispatchEvent(new DragEvent(input.type, { bubbles: true, dataTransfer: data }))
    },
    { type, total },
  )
}

/** Chromium 拒直连这些端口（ERR_UNSAFE_PORT）；listen(0) 偶尔会抽到。 */
const UNSAFE_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6697, 10080,
])

export interface E2eGateway {
  readonly origin: string
  readonly entryUrl: string
  readonly workspaceDir: string
  readonly workspaceId: string
}

/** 两个工作目录：验项目筛选多选。 */
export interface MultiE2eGateway extends E2eGateway {
  readonly secondWorkspaceId: string
}

type TestFixtures = {
  gateway: E2eGateway
  complexGateway: E2eGateway
  /** 只装 6 个批量会话，用来验侧栏分组与分页。 */
  navGateway: E2eGateway
  /** 两个项目各装若干会话，用来验多选筛选。 */
  multiGateway: MultiE2eGateway
  /** 固定模型目录：已连接/未连接/自定义三组。 */
  modelsGateway: E2eGateway
  /** 没有任何可用模型，用来验 Composer 空态。 */
  emptyModelsGateway: E2eGateway
}

/** 起 Gateway 并躲开 Chromium 禁用端口。 */
async function startGateway(options: ConstructorParameters<typeof Gateway>[0]) {
  let gateway = new Gateway(options)
  let port = await gateway.start()

  // listen(0) 偶尔抽到 Chromium 的禁用端口，重起到能直连为止
  for (let attempt = 0; attempt < 5 && UNSAFE_PORTS.has(port); attempt += 1) {
    await gateway.stop()
    gateway = new Gateway(options)
    port = await gateway.start()
  }

  return { gateway, port }
}

async function withGateway(
  seed: (sessionDir: string, workspaceDir: string) => void,
  use: (gateway: E2eGateway) => Promise<void>,
) {
  const temp = await mkdtemp(join(tmpdir(), "pig-e2e-"))
  const workspaceDir = join(temp, "workspace")
  const sessionDir = join(temp, "sessions")
  await mkdir(workspaceDir)
  await mkdir(sessionDir)
  await writeFile(join(workspaceDir, ".keep"), "")
  seed(sessionDir, workspaceDir)

  const workspaceId = canonicalizeWorkspacePath(workspaceDir)
  const platformPort: DirectoryPort = {
    async selectDirectory() {
      return workspaceDir
    },
    async validateDirectory(path) {
      return path
    },
  }
  const { gateway, port } = await startGateway({
    webRoot,
    sessionDir,
    cwd: workspaceDir,
    platformPort,
    port: 0,
  })

  try {
    await use({
      origin: `http://127.0.0.1:${port}`,
      entryUrl: gateway.authenticatedUrl(`http://127.0.0.1:${port}`),
      workspaceDir,
      workspaceId,
    })
  } finally {
    await gateway.stop()
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

async function withTwoWorkspaces(use: (gateway: MultiE2eGateway) => Promise<void>) {
  const temp = await mkdtemp(join(tmpdir(), "pig-e2e-"))
  const firstDir = join(temp, "workspace-a")
  const secondDir = join(temp, "workspace-b")
  const sessionDir = join(temp, "sessions")
  await mkdir(firstDir)
  await mkdir(secondDir)
  await mkdir(sessionDir)
  await writeFile(join(firstDir, ".keep"), "")
  await writeFile(join(secondDir, ".keep"), "")
  prebuildFillerSessions(sessionDir, firstDir, 3)
  prebuildFillerSessions(sessionDir, secondDir, 2, "e2e-other")

  const platformPort: DirectoryPort = {
    async selectDirectory() {
      return firstDir
    },
    async validateDirectory(path) {
      return path
    },
  }
  const { gateway, port } = await startGateway({
    webRoot,
    sessionDir,
    cwd: firstDir,
    platformPort,
    port: 0,
  })

  try {
    await use({
      origin: `http://127.0.0.1:${port}`,
      entryUrl: gateway.authenticatedUrl(`http://127.0.0.1:${port}`),
      workspaceDir: firstDir,
      workspaceId: canonicalizeWorkspacePath(firstDir),
      secondWorkspaceId: canonicalizeWorkspacePath(secondDir),
    })
  } finally {
    await gateway.stop()
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

/** 模型配置页：临时 agentDir + 假 runtime，隔离本机 ~/.pi。 */
async function withModelsGateway(
  use: (gateway: E2eGateway) => Promise<void>,
  specs?: FakeProviderSpec[],
) {
  const temp = await mkdtemp(join(tmpdir(), "pig-e2e-models-"))
  const workspaceDir = join(temp, "workspace")
  const sessionDir = join(temp, "sessions")
  const agentDir = join(temp, "agent")
  await mkdir(workspaceDir)
  await mkdir(sessionDir)
  await mkdir(agentDir)
  await writeFile(join(workspaceDir, ".keep"), "")
  await writeFile(
    join(agentDir, "models.json"),
    JSON.stringify({
      providers: {
        ollama: {
          name: "本地 Ollama",
          baseUrl: "http://localhost:11434/v1",
          api: "openai-completions",
          models: [{ id: "llama3.1:8b" }],
        },
      },
    }),
  )

  const runtime = createFakeRuntime(
    specs ?? [
      {
        id: "anthropic",
        name: "Anthropic",
        configured: true,
        models: [
          { id: "claude-opus-4-7", name: "Claude Opus 4.7", reasoning: true },
          { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", reasoning: true },
          { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
        ],
      },
      { id: "openai", name: "OpenAI", models: [{ id: "gpt-5", name: "GPT-5" }] },
      { id: "google", name: "Google", models: [{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" }] },
      { id: "mistral", name: "Mistral", models: [{ id: "mistral-large", name: "Mistral Large" }] },
      {
        id: "openrouter",
        name: "OpenRouter",
        models: [{ id: "openrouter/auto", name: "Auto" }],
      },
      { id: "xai", name: "xAI", models: [{ id: "grok-4", name: "Grok 4" }] },
      {
        id: "deepseek",
        name: "DeepSeek",
        configured: true,
        failTest: true,
        models: [{ id: "deepseek-chat", name: "DeepSeek Chat" }],
      },
      {
        id: "ollama",
        name: "本地 Ollama",
        baseUrl: "http://localhost:11434/v1",
        models: [{ id: "llama3.1:8b", name: "Llama 3.1 8B", contextWindow: 128_000 }],
      },
    ],
    {
      modelsPath: join(agentDir, "models.json"),
      addModelOnRefresh: {
        provider: "anthropic",
        model: { id: "claude-sonnet-5", name: "Claude Sonnet 5", reasoning: true },
      },
    },
  )
  const platformPort: DirectoryPort = {
    async selectDirectory() {
      return workspaceDir
    },
    async validateDirectory(path) {
      return path
    },
  }
  const { gateway, port } = await startGateway({
    webRoot,
    sessionDir,
    cwd: workspaceDir,
    platformPort,
    port: 0,
    agentDir,
    createRuntime: async () => runtime as never,
  })

  try {
    await use({
      origin: `http://127.0.0.1:${port}`,
      entryUrl: gateway.authenticatedUrl(`http://127.0.0.1:${port}`),
      workspaceDir,
      workspaceId: canonicalizeWorkspacePath(workspaceDir),
    })
  } finally {
    await gateway.stop()
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

export const test = base.extend<TestFixtures>({
  gateway: [
    async ({}, use) => {
      await withGateway(() => undefined, use)
    },
    { scope: "test" },
  ],
  complexGateway: [
    async ({}, use) => {
      await withGateway((sessionDir, workspaceDir) => {
        const built = prebuildComplexSession(sessionDir, workspaceDir)
        console.log(`预构建会话 ${built.id}${built.forked ? "（fork 本机历史）" : "（合成样本）"}`)
      }, use)
    },
    { scope: "test" },
  ],
  navGateway: [
    async ({}, use) => {
      await withGateway((sessionDir, workspaceDir) => {
        prebuildFillerSessions(sessionDir, workspaceDir, 6)
      }, use)
    },
    { scope: "test" },
  ],
  multiGateway: [
    async ({}, use) => {
      await withTwoWorkspaces(use)
    },
    { scope: "test" },
  ],
  modelsGateway: [
    async ({}, use) => {
      await withModelsGateway(use)
    },
    { scope: "test" },
  ],
  emptyModelsGateway: [
    async ({}, use) => {
      await withModelsGateway(use, [])
    },
    { scope: "test" },
  ],
})

export { expect }
