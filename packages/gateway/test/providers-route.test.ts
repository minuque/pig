import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import Gateway from "../src/index.js"

const model = {
  provider: "anthropic",
  id: "claude-sonnet",
  name: "Claude Sonnet",
  api: "anthropic-messages",
  reasoning: true,
  input: ["text"],
  contextWindow: 200_000,
  maxTokens: 32_000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}
const provider = {
  id: "anthropic",
  name: "Anthropic",
  baseUrl: "https://api.test.local",
  auth: { apiKey: { login: async () => undefined } },
  getModels: () => [model],
}

function fakeRuntime() {
  return {
    getProviders: () => [provider],
    getProviderAuthStatus: () => ({ configured: true, source: "stored" }),
    getModels: () => [model],
    getAvailable: async () => [model],
    hasConfiguredAuth: () => true,
    getModel: () => undefined,
  }
}

let gateway: Gateway | undefined
let tempDir: string | undefined

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  if (tempDir) await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })
  tempDir = undefined
})

async function start() {
  tempDir = await mkdtemp(join(tmpdir(), "pig-providers-"))
  gateway = new Gateway({
    createRuntime: async () => fakeRuntime() as never,
    sessionDir: join(tempDir, "sessions"),
    agentDir: join(tempDir, "agent"),
  })
  const base = `http://127.0.0.1:${await gateway.start()}`
  return { base, auth: gateway.authorizationHeader() }
}

describe("provider routes", () => {
  it("GET /providers 返回视图、来源与 defaultModel，不含凭据明文", async () => {
    const { base, auth } = await start()
    const response = await fetch(`${base}/api/v1/platform/providers`, {
      headers: { authorization: auth },
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      providers: Array<Record<string, unknown>>
      defaultModel: unknown
    }

    expect(body.defaultModel).toBeNull()
    expect(body.providers).toEqual([
      {
        id: "anthropic",
        name: "Anthropic",
        baseUrl: "https://api.test.local",
        api: "anthropic-messages",
        kind: "builtin",
        capabilities: { apiKey: true, oauth: false, ambient: false },
        status: { configured: true, source: "stored", hint: null },
        models: [
          {
            id: "claude-sonnet",
            name: "Claude Sonnet",
            input: ["text"],
            reasoning: true,
            contextWindow: 200_000,
            maxTokens: 32_000,
          },
        ],
      },
    ])
    expect(JSON.stringify(body)).not.toContain("sk-")
  })

  it("GET /models 返回协议模型目录", async () => {
    const { base, auth } = await start()
    const response = await fetch(`${base}/api/v1/platform/models`, {
      headers: { authorization: auth },
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      models: Array<{ provider: string; id: string; authenticated: boolean }>
    }

    expect(body.models).toHaveLength(1)
    expect(body.models[0]).toMatchObject({
      provider: "anthropic",
      id: "claude-sonnet",
      authenticated: true,
    })
  })

  it("列表只给 Key 末四位，复制端点单独回明文", async () => {
    const { base, auth } = await start()
    const agentDir = join(tempDir!, "agent")
    const storedKey = "sk-ant-test-4f2a"

    await mkdir(agentDir, { recursive: true })
    await writeFile(
      join(agentDir, "auth.json"),
      JSON.stringify({ anthropic: { type: "api_key", key: storedKey } }),
    )

    const list = await fetch(`${base}/api/v1/platform/providers`, {
      headers: { authorization: auth },
    })
    const body = (await list.json()) as {
      providers: Array<{ status: Record<string, unknown> }>
    }

    expect(body.providers[0]?.status).toEqual({
      configured: true,
      source: "stored",
      hint: storedKey.slice(-4),
    })
    expect(JSON.stringify(body)).not.toContain(storedKey)

    const copy = await fetch(`${base}/api/v1/platform/providers/anthropic/key`, {
      headers: { authorization: auth },
    })

    expect(copy.status).toBe(200)
    expect(await copy.json()).toEqual({ key: storedKey })

    const missing = await fetch(`${base}/api/v1/platform/providers/openai/key`, {
      headers: { authorization: auth },
    })

    expect(missing.status).toBe(404)
  })
})
