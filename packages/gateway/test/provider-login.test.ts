import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import Gateway from "../src/index.js"
import {
  ProviderService,
  ProviderServiceError,
  type LoginEventView,
} from "../src/pi/provider-service.js"

type Prompt = { type: string; message?: string }

function loginRuntime(options: { fail?: boolean } = {}) {
  const prompts: string[] = []
  const refresh = vi.fn(async () => ({ aborted: false, errors: new Map() }))
  const logout = vi.fn(async () => undefined)
  const provider = {
    id: "anthropic",
    name: "Anthropic",
    auth: {
      apiKey: { name: "API key", login: async () => ({ type: "api_key" }) },
      oauth: { name: "OAuth", login: async () => ({ type: "oauth" }) },
    },
  }
  const runtime = {
    getProvider: (id: string) => (id === "anthropic" ? provider : undefined),
    getProviders: () => [provider],
    login: async (
      _id: string,
      _type: string,
      interaction: {
        notify(event: { type: string; url?: string }): void
        prompt(prompt: Prompt): Promise<string>
      },
    ) => {
      interaction.notify({ type: "auth_url", url: "https://auth.example/login" })
      const value = await interaction.prompt({ type: "secret", message: "API Key" })
      prompts.push(value)

      if (options.fail) throw new Error("upstream rejected the credential")
      return { type: "api_key", key: value }
    },
    refresh,
    logout,
  }
  return { runtime, prompts, refresh, logout }
}

let tempDir: string | undefined
const service = (runtime: unknown) =>
  new ProviderService({
    runtime: async () => runtime as never,
    ...(tempDir ? { agentDir: tempDir } : {}),
  })

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })

  tempDir = undefined
})

async function collect(events: AsyncIterable<LoginEventView>) {
  const collected: LoginEventView[] = []

  for await (const event of events) collected.push(event)
  return collected
}

describe("ProviderService login", () => {
  it("按顺序推送 auth_url 与 prompt，回答后落 done 并刷新 runtime", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))
    const fake = loginRuntime()
    const providers = service(fake.runtime)
    const { loginId } = await providers.login("anthropic", "api_key")
    const pending: LoginEventView[] = []
    const consuming = (async () => {
      for await (const event of providers.loginEvents(loginId)) pending.push(event)
    })()

    await vi.waitFor(() =>
      expect(pending.map((event) => event.type)).toEqual(["auth_url", "prompt"]),
    )
    const prompt = pending[1]

    expect(prompt).toMatchObject({ type: "prompt", prompt: { type: "secret" } })
    await providers.respond(loginId, "sk-test")
    await consuming

    expect(pending.map((event) => event.type)).toEqual(["auth_url", "prompt", "done"])
    expect(fake.prompts).toEqual(["sk-test"])
    expect(fake.refresh).toHaveBeenCalledWith({ providers: ["anthropic"] })
    expect(pending.map((event) => event.seq)).toEqual([1, 2, 3])
  })

  it("after 重放只给序号更大的事件", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))
    const providers = service(loginRuntime().runtime)
    const { loginId } = await providers.login("anthropic", "api_key")
    const first = collect(providers.loginEvents(loginId, 0))
    await new Promise((resolve) => setTimeout(resolve, 10))
    await providers.respond(loginId, "sk-test")
    await first

    const replay = await collect(providers.loginEvents(loginId, 1))

    expect(replay.map((event) => event.type)).toEqual(["prompt", "done"])
  })

  it("同一供应商已有登录进行中时拒绝第二次", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))
    const providers = service(loginRuntime().runtime)
    await providers.login("anthropic", "api_key")

    await expect(providers.login("anthropic", "oauth")).rejects.toMatchObject({ status: 409 })
    await expect(providers.login("anthropic", "oauth")).rejects.toBeInstanceOf(ProviderServiceError)
  })

  it("取消中止进行中的登录并删除会话", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))
    const providers = service(loginRuntime().runtime)
    const { loginId } = await providers.login("anthropic", "api_key")
    const events: LoginEventView[] = []
    const consuming = (async () => {
      for await (const event of providers.loginEvents(loginId)) events.push(event)
    })()

    await vi.waitFor(() =>
      expect(events.map((event) => event.type)).toEqual(["auth_url", "prompt"]),
    )

    await providers.cancelLogin(loginId)
    await consuming

    await expect(collect(providers.loginEvents(loginId))).rejects.toMatchObject({ status: 404 })
  })

  it("登录失败推送 error 事件并保留给订阅者重放", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))
    const providers = service(loginRuntime({ fail: true }).runtime)
    const { loginId } = await providers.login("anthropic", "api_key")
    const events: LoginEventView[] = []
    const consuming = (async () => {
      for await (const event of providers.loginEvents(loginId)) events.push(event)
    })()

    await vi.waitFor(() => expect(events.map((event) => event.type)).toContain("prompt"))
    await providers.respond(loginId, "sk-test")
    await consuming

    expect(events.at(-1)).toMatchObject({
      type: "error",
      message: "upstream rejected the credential",
    })
  })

  it("未知供应商与不支持的接入方式直接拒绝", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))
    const providers = service(loginRuntime().runtime)

    await expect(providers.login("missing", "api_key")).rejects.toMatchObject({ status: 404 })

    const { loginId } = await providers.login("anthropic", "oauth")

    expect(loginId).toBeTypeOf("string")
    await providers.cancelLogin(loginId)
  })

  it("登出清凭据并刷新 runtime", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))
    const fake = loginRuntime()
    const providers = service(fake.runtime)
    await providers.logout("anthropic")

    expect(fake.logout).toHaveBeenCalledWith("anthropic", expect.anything())
    expect(fake.refresh).toHaveBeenCalledWith({ providers: ["anthropic"] })
  })
})

describe("login routes", () => {
  let gateway: Gateway | undefined

  afterEach(async () => {
    await gateway?.stop()
    gateway = undefined
  })

  it("SSE 帧带 id 与 event，重复登录回 409", async () => {
    const fake = loginRuntime()
    gateway = new Gateway({
      createRuntime: async () => fake.runtime as never,
      sessionDir: join((tempDir = await mkdtemp(join(tmpdir(), "pig-login-"))), "sessions"),
      agentDir: join(tempDir, "agent"),
    })
    const base = `http://127.0.0.1:${await gateway.start()}`
    const authorization = gateway.authorizationHeader()
    const headers = {
      authorization,
      "content-type": "application/json",
    }
    const response = await fetch(`${base}/api/v1/platform/providers/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ providerId: "anthropic", type: "api_key" }),
    })
    const { loginId } = (await response.json()) as { loginId: string }

    expect(response.status).toBe(200)

    const duplicate = await fetch(`${base}/api/v1/platform/providers/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ providerId: "anthropic", type: "oauth" }),
    })

    expect(duplicate.status).toBe(409)

    const stream = await fetch(`${base}/api/v1/platform/providers/login/${loginId}/events`, {
      headers: { authorization: gateway.authorizationHeader() },
    })

    expect(stream.headers.get("content-type")).toContain("text/event-stream")
    const reader = stream.body!.getReader()
    const decoder = new TextDecoder()
    let text = ""

    await vi.waitFor(async () => {
      text += decoder.decode((await reader.read()).value)
      expect(text).toContain("event: prompt")
    })
    expect(text).toContain("id: 1")

    await fetch(`${base}/api/v1/platform/providers/login/${loginId}/responses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ value: "sk-test" }),
    })
    await reader.cancel()
  })
})
