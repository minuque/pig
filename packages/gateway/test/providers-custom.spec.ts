import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import Gateway from "../src/index.js"
import { ProviderService } from "../src/pi/provider-service.js"
import type { CustomProviderInput } from "../src/pi/provider-service.js"

const input = (overrides: Partial<CustomProviderInput> = {}): CustomProviderInput => ({
  id: "ollama",
  name: "本地 Ollama",
  baseUrl: "http://localhost:11434/v1",
  api: "openai-completions",
  models: [{ id: "llama3.1:8b", name: "Llama 3.1 8B", contextWindow: 128_000 }],
  ...overrides,
})

function customRuntime() {
  const refresh = vi.fn(async () => ({ aborted: false, errors: new Map() }))
  const provider = { id: "ollama", name: "本地 Ollama", auth: {} }
  return {
    refresh,
    getProvider: (id: string) => (id === "ollama" ? provider : undefined),
    getProviders: () => [provider],
  }
}

let tempDir: string | undefined
let gateway: Gateway | undefined

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  if (tempDir) await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })
  tempDir = undefined
})

async function paths() {
  tempDir = await mkdtemp(join(tmpdir(), "pig-custom-"))
  const agentDir = join(tempDir, "agent")

  await mkdir(agentDir, { recursive: true })
  return { agentDir, modelsPath: join(agentDir, "models.json") }
}

describe("ProviderService custom providers", () => {
  it("保存后写入 providers[id] 并刷新该供应商", async () => {
    const { agentDir, modelsPath } = await paths()
    const fake = customRuntime()
    const providers = new ProviderService({ runtime: async () => fake, agentDir } as never)

    await providers.saveCustom(input())

    const saved = JSON.parse(await readFile(modelsPath, "utf-8")) as {
      providers: Record<string, Record<string, unknown>>
    }

    expect(saved.providers.ollama).toMatchObject({
      name: "本地 Ollama",
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      models: [{ id: "llama3.1:8b", name: "Llama 3.1 8B", contextWindow: 128_000 }],
    })
    expect(fake.refresh).toHaveBeenCalledWith({ providers: ["ollama"] })
  })

  it("apiKey 留空保留旧值，新值覆盖", async () => {
    const { agentDir, modelsPath } = await paths()
    const fake = customRuntime()
    const providers = new ProviderService({ runtime: async () => fake, agentDir } as never)

    await providers.saveCustom(input({ apiKey: "old-key" }))
    await providers.saveCustom(input({ apiKey: "" }))

    let saved = JSON.parse(await readFile(modelsPath, "utf-8")) as {
      providers: Record<string, Record<string, unknown>>
    }

    expect(saved.providers.ollama?.apiKey).toBe("old-key")

    await providers.saveCustom(input({ apiKey: "new-key" }))
    saved = JSON.parse(await readFile(modelsPath, "utf-8")) as typeof saved

    expect(saved.providers.ollama?.apiKey).toBe("new-key")
  })

  it("损坏的 models.json 拒绝写入并保留原文件", async () => {
    const { agentDir, modelsPath } = await paths()
    const contents = "{ broken"

    await writeFile(modelsPath, contents)

    const providers = new ProviderService({
      runtime: async () => customRuntime(),
      agentDir,
    } as never)

    await expect(providers.saveCustom(input())).rejects.toMatchObject({ status: 409 })
    expect(await readFile(modelsPath, "utf-8")).toBe(contents)
  })

  it("删除供应商后刷新，未知供应商 404", async () => {
    const { agentDir, modelsPath } = await paths()
    const fake = customRuntime()
    const providers = new ProviderService({ runtime: async () => fake, agentDir } as never)

    await providers.saveCustom(input())
    await providers.deleteCustom("ollama")

    const saved = JSON.parse(await readFile(modelsPath, "utf-8")) as {
      providers: Record<string, unknown>
    }

    expect(saved.providers).toEqual({})
    expect(fake.refresh).toHaveBeenCalledTimes(2)
    await expect(providers.deleteCustom("missing")).rejects.toMatchObject({ status: 404 })
  })
})

describe("custom provider routes", () => {
  it("PUT 与 DELETE 走同一存储并刷新", async () => {
    const { agentDir, modelsPath } = await paths()
    const fake = customRuntime()
    gateway = new Gateway({
      createRuntime: async () => fake as never,
      sessionDir: join(tempDir!, "sessions"),
      agentDir,
    })
    const base = `http://127.0.0.1:${await gateway.start()}`
    const headers = {
      authorization: gateway.authorizationHeader(),
      "content-type": "application/json",
    }
    const put = await fetch(`${base}/api/v1/platform/providers/custom/ollama`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        name: "本地 Ollama",
        baseUrl: "http://localhost:11434/v1",
        api: "openai-completions",
        models: [{ id: "llama3.1:8b" }],
      }),
    })

    expect(put.status).toBe(200)
    expect(fake.refresh).toHaveBeenCalledWith({ providers: ["ollama"] })

    const saved = JSON.parse(await readFile(modelsPath, "utf-8")) as {
      providers: Record<string, unknown>
    }

    expect(saved.providers.ollama).toMatchObject({ name: "本地 Ollama" })

    const removed = await fetch(`${base}/api/v1/platform/providers/custom/ollama`, {
      method: "DELETE",
      headers,
    })

    expect(removed.status).toBe(200)
    expect(fake.refresh).toHaveBeenCalledTimes(2)
  })

  it("损坏的文件回 409", async () => {
    const { agentDir, modelsPath } = await paths()

    await writeFile(modelsPath, "{ broken")

    gateway = new Gateway({
      createRuntime: async () => customRuntime() as never,
      sessionDir: join(tempDir!, "sessions"),
      agentDir,
    })
    const base = `http://127.0.0.1:${await gateway.start()}`
    const authorization = gateway.authorizationHeader()
    const response = await fetch(`${base}/api/v1/platform/providers/custom/ollama`, {
      method: "PUT",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "本地 Ollama",
        api: "openai-completions",
        models: [{ id: "llama3.1:8b" }],
      }),
    })

    expect(response.status).toBe(409)
  })
})
