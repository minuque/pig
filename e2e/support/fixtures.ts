import { test as base, expect, type Page } from "@playwright/test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import Gateway from "../../packages/gateway/src/index.js"
import type { DirectoryPort } from "../../packages/gateway/src/system/directory.js"
import { createFakeRuntime, type FakeProviderSpec } from "./fake-model-runtime.js"
import { BUILTIN_PROVIDERS } from "./fake-provider-registry.js"
import {
  prebuildComplexSession,
  prebuildFillerSessions,
  prebuildChildSession,
  prebuildExternalTurnSession,
} from "./prebuild-session.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const webRoot = join(root, "apps/web/dist")

export function canonicalizeWorkspacePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "")
  return /^[a-zA-Z]:/.test(normalized) ? normalized.toLowerCase() : normalized
}

export async function seedWorkspaces(page: Page, workspaceIds: readonly string[]) {
  await page.addInitScript(
    ({ ids }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify(ids))
      localStorage.setItem("pig.lastCwd", ids[0] ?? "")
      localStorage.setItem("npg-theme", "light")
      localStorage.setItem("pig.files.open", "off")
    },
    { ids: workspaceIds },
  )
}

export async function seedWorkspace(page: Page, workspaceId: string) {
  await seedWorkspaces(page, [workspaceId])
}

// 外部：DataTransfer 只能在页面里造
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

// 外部：Chromium 拒直连这些端口（ERR_UNSAFE_PORT），listen(0) 偶尔会抽到
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
  readonly pigHome: string
}

export interface MultiE2eGateway extends E2eGateway {
  readonly secondWorkspaceId: string
}

export interface ExternalTurnGateway extends E2eGateway {
  readonly sessionFile: string
}

type TestFixtures = {
  gateway: E2eGateway
  externalTurnGateway: ExternalTurnGateway
  complexGateway: E2eGateway
  navGateway: E2eGateway
  multiGateway: MultiE2eGateway
  modelsGateway: E2eGateway
  emptyModelsGateway: E2eGateway
  subagentGateway: E2eGateway
}

async function startGateway(
  options: ConstructorParameters<typeof Gateway>[0] & { agentDir: string },
) {
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR
  process.env.PI_CODING_AGENT_DIR = options.agentDir
  let gateway = new Gateway(options)
  let port = await gateway.start()

  for (let attempt = 0; attempt < 5 && UNSAFE_PORTS.has(port); attempt += 1) {
    await gateway.stop()
    gateway = new Gateway(options)
    port = await gateway.start()
  }

  const stop = async () => {
    try {
      await gateway.stop()
    } finally {
      if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
      else process.env.PI_CODING_AGENT_DIR = previousAgentDir
    }
  }

  return { gateway, port, stop }
}

export async function withGateway(
  seed: (sessionDir: string, workspaceDir: string) => void,
  use: (gateway: E2eGateway) => Promise<void>,
  prepareAgent: (agentDir: string) => Promise<void> = writeOfflineModel,
) {
  const temp = await mkdtemp(join(tmpdir(), "pig-e2e-"))
  const workspaceDir = join(temp, "workspace")
  const sessionDir = join(temp, "sessions")
  const pigHome = join(temp, "pig-home")
  await mkdir(workspaceDir)
  await mkdir(sessionDir)
  await mkdir(pigHome)
  await writeFile(join(workspaceDir, ".keep"), "")
  seed(sessionDir, workspaceDir)
  const agentDir = join(temp, "agent")

  await mkdir(agentDir)
  await prepareAgent(agentDir)

  const workspaceId = canonicalizeWorkspacePath(workspaceDir)
  const platformPort: DirectoryPort = {
    async selectDirectory() {
      return workspaceDir
    },
    async validateDirectory(path) {
      return path
    },
  }
  const { gateway, port, stop } = await startGateway({
    webRoot,
    sessionDir,
    pigHome,
    cwd: workspaceDir,
    platformPort,
    port: 0,
    agentDir,
  })

  try {
    await use({
      origin: `http://127.0.0.1:${port}`,
      entryUrl: gateway.authenticatedUrl(`http://127.0.0.1:${port}`),
      workspaceDir,
      workspaceId,
      pigHome,
    })
  } finally {
    await stop()
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
  const agentDir = join(temp, "agent")
  await mkdir(agentDir)
  await writeOfflineModel(agentDir)

  const platformPort: DirectoryPort = {
    async selectDirectory() {
      return firstDir
    },
    async validateDirectory(path) {
      return path
    },
  }
  const { gateway, port, stop } = await startGateway({
    webRoot,
    sessionDir,
    pigHome: join(temp, "pig-home"),
    cwd: firstDir,
    platformPort,
    port: 0,
    agentDir,
  })

  try {
    await use({
      origin: `http://127.0.0.1:${port}`,
      entryUrl: gateway.authenticatedUrl(`http://127.0.0.1:${port}`),
      workspaceDir: firstDir,
      workspaceId: canonicalizeWorkspacePath(firstDir),
      secondWorkspaceId: canonicalizeWorkspacePath(secondDir),
      pigHome: join(temp, "pig-home"),
    })
  } finally {
    await stop()
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

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
    join(agentDir, "auth.json"),
    JSON.stringify({
      anthropic: { type: "api_key", key: "sk-ant-e2e-4f2a" },
      openai: { type: "api_key", key: "{{SECRET_jssv7fkn}}" },
    }),
  )
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
        lmstudio: {
          name: "LM Studio",
          baseUrl: "http://localhost:1234/v1",
          api: "openai-completions",
          models: [{ id: "qwen3-32b" }],
        },
        vllm: {
          name: "内网 vLLM",
          baseUrl: "http://10.0.0.8:8000/v1",
          api: "openai-completions",
          models: [{ id: "deepseek-v3" }],
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
          {
            id: "claude-opus-4-7",
            name: "Claude Opus 4.7",
            reasoning: true,
            samplingParams: { temperature: 1, top_p: 0.95 },
          },
          { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", reasoning: true },
          { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
        ],
      },
      {
        id: "openai",
        name: "OpenAI",
        auth: "both",
        models: [{ id: "gpt-5", name: "GPT-5" }],
      },
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
        api: "openai-completions",
        models: [{ id: "llama3.1:8b", name: "Llama 3.1 8B", contextWindow: 128_000 }],
      },
      {
        id: "lmstudio",
        name: "LM Studio",
        baseUrl: "http://localhost:1234/v1",
        api: "openai-completions",
        models: [{ id: "qwen3-32b", name: "Qwen3 32B", contextWindow: 128_000 }],
      },
      {
        id: "vllm",
        name: "内网 vLLM",
        baseUrl: "http://10.0.0.8:8000/v1",
        api: "openai-completions",
        models: [{ id: "deepseek-v3", name: "DeepSeek V3", contextWindow: 128_000 }],
      },
      ...BUILTIN_PROVIDERS.filter(
        (provider) => !["anthropic", "openai", "deepseek"].includes(provider.id),
      ).map((provider) => ({ ...provider, models: [] })),
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
  const { gateway, port, stop } = await startGateway({
    webRoot,
    sessionDir,
    pigHome: join(temp, "pig-home"),
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
      pigHome: join(temp, "pig-home"),
    })
  } finally {
    await stop()
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
  externalTurnGateway: [
    async ({}, use) => {
      let sessionFile = ""

      await withGateway(
        (sessionDir, workspaceDir) => {
          sessionFile = prebuildExternalTurnSession(sessionDir, workspaceDir)
        },
        (gateway) => use({ ...gateway, sessionFile }),
      )
    },
    { scope: "test" },
  ],
  complexGateway: [
    async ({}, use) => {
      await withGateway(
        (sessionDir, workspaceDir) => void prebuildComplexSession(sessionDir, workspaceDir),
        use,
      )
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
  subagentGateway: [
    async ({}, use) => {
      await withGateway((sessionDir, workspaceDir) => {
        prebuildFillerSessions(sessionDir, workspaceDir, 1)
        prebuildChildSession(sessionDir, workspaceDir)
      }, use)
    },
    { scope: "test" },
  ],
})

async function writeOfflineModel(agentDir: string) {
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({ defaultProvider: "local", defaultModel: "e2e-model" }),
  )
  await writeFile(
    join(agentDir, "models.json"),
    JSON.stringify({
      providers: {
        local: {
          name: "本地",
          baseUrl: "http://127.0.0.1:9/v1",
          api: "openai-completions",
          apiKey: "e2e",
          models: [{ id: "e2e-model" }],
        },
      },
    }),
  )
}

export { expect }
