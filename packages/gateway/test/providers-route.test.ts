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
    getProvider: () => provider,
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

async function start(runtime: Record<string, unknown> = fakeRuntime()) {
  tempDir = await mkdtemp(join(tmpdir(), "pig-providers-"))
  gateway = new Gateway({
    createRuntime: async () => runtime as never,
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
            enabled: true,
          },
        ],
      },
    ])
    expect(JSON.stringify(body)).not.toContain("sk-")
  })

  it("POST /providers/refresh 先刷新 runtime 再返回新目录", async () => {
    const models = [model]
    let refreshed = 0
    const extra = { ...model, id: "claude-opus", name: "Claude Opus" }
    const base = fakeRuntime()
    const { base: url, auth } = await start({
      ...base,
      getProviders: () => [{ ...provider, getModels: () => models }],
      getModels: () => models,
      refresh: async () => {
        refreshed += 1
        models.push(extra)
        return { aborted: false, errors: new Map() }
      },
    })
    const response = await fetch(`${url}/api/v1/platform/providers/refresh`, {
      method: "POST",
      headers: { authorization: auth },
    })

    expect(response.status).toBe(200)
    expect(refreshed).toBe(1)

    const body = (await response.json()) as {
      providers: Array<{ models: Array<{ id: string }> }>
      defaultModel: unknown
    }

    expect(body.defaultModel).toBeNull()
    expect(body.providers[0]?.models.map((item) => item.id)).toEqual([
      "claude-sonnet",
      "claude-opus",
    ])
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

  it("PUT /models/:id/enabled 写入开放列表，GET /models 过滤关闭的模型", async () => {
    const extra = { ...model, id: "claude-opus", name: "Claude Opus" }
    const base = fakeRuntime()
    const { base: url, auth } = await start({
      ...base,
      getProviders: () => [{ ...provider, getModels: () => [model, extra] }],
      getModels: () => [model, extra],
      getAvailable: async () => [model, extra],
    })
    const toggle = await fetch(
      `${url}/api/v1/platform/providers/anthropic/models/claude-sonnet/enabled`,
      {
        method: "PUT",
        body: JSON.stringify({ enabled: false }),
        headers: { authorization: auth, "content-type": "application/json" },
      },
    )

    expect(toggle.status).toBe(200)

    const list = await fetch(`${url}/api/v1/platform/providers`, {
      headers: { authorization: auth },
    })
    const body = (await list.json()) as {
      providers: Array<{ models: Array<{ id: string; enabled: boolean }> }>
    }

    expect(body.providers[0]?.models).toEqual([
      expect.objectContaining({ id: "claude-sonnet", enabled: false }),
      expect.objectContaining({ id: "claude-opus", enabled: true }),
    ])

    const models = await fetch(`${url}/api/v1/platform/models`, {
      headers: { authorization: auth },
    })
    const catalog = (await models.json()) as { models: Array<{ id: string }> }

    expect(catalog.models.map((item) => item.id)).toEqual(["claude-opus"])
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
