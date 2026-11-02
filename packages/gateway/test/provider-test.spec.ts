import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import Gateway from "../src/index.js"
import { ProviderService } from "../src/pi/provider-service.js"

const model = { id: "claude-sonnet", name: "Claude Sonnet", provider: "anthropic" }

function testRuntime(
  options: { configured?: boolean; fail?: boolean; errorMessage?: string } = {},
) {
  const completeSimple = vi.fn(async () => {
    if (options.fail) throw new Error("401 invalid api key")
    return {
      stopReason: options.errorMessage ? "error" : "stop",
      ...(options.errorMessage ? { errorMessage: options.errorMessage } : {}),
    }
  })
  const provider = {
    id: "anthropic",
    name: "Anthropic",
    auth: { apiKey: { login: async () => undefined } },
    getModels: () => [model],
  }
  return {
    completeSimple,
    getProvider: (id: string) => (id === "anthropic" ? provider : undefined),
    getProviderAuthStatus: () => ({ configured: options.configured ?? true, source: "stored" }),
    getModels: (id?: string) => (id === "anthropic" ? [model] : []),
  }
}

const service = (runtime: unknown) => new ProviderService({ runtime: async () => runtime as never })

describe("ProviderService.testConnection", () => {
  it("发一条 ping 且 maxTokens 为 1，成功时返回耗时", async () => {
    const runtime = testRuntime()
    const result = await service(runtime).testConnection("anthropic")

    expect(result).toMatchObject({ ok: true })
    expect(result.latencyMs).toBeTypeOf("number")
    expect(runtime.completeSimple).toHaveBeenCalledWith(
      model,
      {
        messages: [{ role: "user", content: "ping", timestamp: expect.any(Number) }],
      },
      { maxTokens: 1 },
    )
  })

  it("上游抛错时返回原文", async () => {
    const result = await service(testRuntime({ fail: true })).testConnection("anthropic")

    expect(result).toEqual({ ok: false, message: "401 invalid api key" })
  })

  it("stopReason 为 error 时返回错误消息并截断到 500 字", async () => {
    const result = await service(testRuntime({ errorMessage: "x".repeat(600) })).testConnection(
      "anthropic",
    )

    expect(result.ok).toBe(false)
    expect(result.message).toHaveLength(500)
  })

  it("未知供应商 404，未配置或没有模型 409", async () => {
    await expect(service(testRuntime()).testConnection("missing")).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      service(testRuntime({ configured: false })).testConnection("anthropic"),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      service(testRuntime()).testConnection("anthropic", "missing-model"),
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe("test route", () => {
  let gateway: Gateway | undefined
  let tempDir: string | undefined

  afterEach(async () => {
    await gateway?.stop()
    gateway = undefined

    if (tempDir) await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })
    tempDir = undefined
  })

  it("POST /providers/test 返回结果，未知供应商回 404", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-provider-test-"))
    const runtime = testRuntime()
    gateway = new Gateway({
      createRuntime: async () => runtime as never,
      sessionDir: join(tempDir, "sessions"),
      agentDir: join(tempDir, "agent"),
    })
    const base = `http://127.0.0.1:${await gateway.start()}`
    const headers = { authorization: gateway.authorizationHeader() }
    const response = await fetch(`${base}/api/v1/platform/providers/test`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ providerId: "anthropic" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })

    const missing = await fetch(`${base}/api/v1/platform/providers/test`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ providerId: "missing" }),
    })

    expect(missing.status).toBe(404)
  })
})
