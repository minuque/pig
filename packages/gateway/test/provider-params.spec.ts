import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import Gateway from "../src/index.js"
import { ProviderService } from "../src/pi/provider-service.js"

function fakeSettings() {
  const levels = new Map<string, string>()
  return {
    levels,
    setModelThinkingLevel: vi.fn((provider: string, model: string, level: string) => {
      levels.set(`${provider}/${model}`, level)
    }),
    removeModelThinkingLevel: vi.fn((provider: string, model: string) => {
      levels.delete(`${provider}/${model}`)
    }),
    flush: vi.fn(async () => undefined),
    getAllModelThinkingLevels: () => Object.fromEntries(levels),
    getDefaultProvider: () => undefined,
    getDefaultModel: () => undefined,
  }
}

function paramRuntime() {
  const refresh = vi.fn(async () => ({ aborted: false, errors: new Map() }))
  const providers = ["anthropic", "ollama"].map((id) => ({
    id,
    name: id,
    auth: { apiKey: { login: async () => undefined } },
  }))
  return {
    refresh,
    getProvider: (id: string) => providers.find((provider) => provider.id === id),
    getProviders: () => providers,
  }
}

let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })
  tempDir = undefined
})

async function serviceWith(models: Record<string, unknown>) {
  tempDir = await mkdtemp(join(tmpdir(), "pig-params-"))
  const agentDir = join(tempDir, "agent")
  const modelsPath = join(agentDir, "models.json")
  const settings = fakeSettings()
  const runtime = paramRuntime()

  await mkdir(agentDir, { recursive: true })
  await writeFile(modelsPath, JSON.stringify(models))

  const providers = new ProviderService({
    runtime: async () => runtime as never,
    agentDir,
    settings: settings as never,
  })
  return { providers, modelsPath, settings, runtime }
}

async function saved(modelsPath: string) {
  return JSON.parse(await readFile(modelsPath, "utf-8")) as {
    providers: Record<string, Record<string, unknown>>
  }
}

describe("updateModelParams", () => {
  it("内置供应商写 modelOverrides，不新增 models", async () => {
    const { providers, modelsPath, runtime } = await serviceWith({ providers: {} })

    await providers.updateModelParams("anthropic", "claude-sonnet", {
      maxTokens: 8192,
      contextWindow: 400_000,
      samplingParams: { temperature: 0.3 },
    })

    const body = await saved(modelsPath)

    expect(body.providers.anthropic?.modelOverrides).toEqual({
      "claude-sonnet": {
        maxTokens: 8192,
        contextWindow: 400_000,
        samplingParams: { temperature: 0.3 },
      },
    })
    expect(body.providers.anthropic?.models).toBeUndefined()
    expect(runtime.refresh).toHaveBeenCalledWith({ providers: ["anthropic"], allowNetwork: true })
  })

  it("带 baseUrl 的内置覆盖仍按内置处理", async () => {
    const { providers, modelsPath } = await serviceWith({
      providers: { anthropic: { baseUrl: "https://proxy.example/v1" } },
    })

    await providers.updateModelParams("anthropic", "claude-sonnet", { maxTokens: 1024 })

    const body = await saved(modelsPath)

    expect(body.providers.anthropic?.models).toBeUndefined()
    expect(body.providers.anthropic?.modelOverrides).toEqual({
      "claude-sonnet": { maxTokens: 1024 },
    })
  })

  it("自定义供应商写进对应 models 条目", async () => {
    const { providers, modelsPath } = await serviceWith({
      providers: { ollama: { name: "Ollama", models: [{ id: "llama3", name: "Llama 3" }] } },
    })

    await providers.updateModelParams("ollama", "llama3", { maxTokens: 4096 })

    const body = await saved(modelsPath)

    expect(body.providers.ollama?.models).toEqual([
      { id: "llama3", name: "Llama 3", maxTokens: 4096 },
    ])
    expect(body.providers.ollama?.modelOverrides).toBeUndefined()
  })

  it("null 删除键，清空后去掉整个覆盖条目", async () => {
    const { providers, modelsPath } = await serviceWith({
      providers: {
        anthropic: {
          modelOverrides: { "claude-sonnet": { maxTokens: 8192, contextWindow: 200_000 } },
        },
      },
    })

    await providers.updateModelParams("anthropic", "claude-sonnet", {
      maxTokens: null,
      contextWindow: null,
      samplingParams: null,
    })

    const body = await saved(modelsPath)

    expect(body.providers.anthropic?.modelOverrides).toEqual({})
  })

  it("thinking 经 SettingsManager 写入并 flush，null 删除", async () => {
    const { providers, settings } = await serviceWith({ providers: {} })

    await providers.updateModelParams("anthropic", "claude-sonnet", { thinkingLevel: "high" })

    expect(settings.levels.get("anthropic/claude-sonnet")).toBe("high")
    expect(settings.flush).toHaveBeenCalledTimes(1)

    await providers.updateModelParams("anthropic", "claude-sonnet", { thinkingLevel: null })

    expect(settings.levels.has("anthropic/claude-sonnet")).toBe(false)
    expect(settings.flush).toHaveBeenCalledTimes(2)
  })

  it("超出规格范围与非法采样值拒绝为 400", async () => {
    const { providers } = await serviceWith({ providers: {} })
    const args = ["anthropic", "claude-sonnet"] as const

    await expect(
      providers.updateModelParams(...args, { maxTokens: 1_000_001 }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      providers.updateModelParams(...args, { contextWindow: 999 }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      providers.updateModelParams(...args, { samplingParams: { temperature: { value: 1 } } }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it("范围外的参数值拒绝为 400", async () => {
    const { providers } = await serviceWith({ providers: {} })

    await expect(
      providers.updateModelParams("anthropic", "claude-sonnet", { maxTokens: -1 }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      providers.updateModelParams("anthropic", "claude-sonnet", {
        thinkingLevel: "bogus" as never,
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      providers.updateModelParams("anthropic", "claude-sonnet", {
        samplingParams: [1] as never,
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe("params route", () => {
  let gateway: Gateway | undefined

  afterEach(async () => {
    await gateway?.stop()
    gateway = undefined
  })

  it("PUT 保存参数并回 { ok }", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-params-route-"))
    const agentDir = join(tempDir, "agent")

    await mkdir(agentDir, { recursive: true })
    await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: {} }))

    gateway = new Gateway({
      createRuntime: async () => paramRuntime() as never,
      sessionDir: join(tempDir, "sessions"),
      agentDir,
    })
    const base = `http://127.0.0.1:${await gateway.start()}`
    const response = await fetch(
      `${base}/api/v1/platform/providers/anthropic/models/claude-sonnet/params`,
      {
        method: "PUT",
        headers: {
          authorization: gateway.authorizationHeader(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ maxTokens: 4096 }),
      },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
