import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { ModelsConfigError, ProviderConfigStore } from "../src/pi/models-config.js"

let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true, maxRetries: 5 })
  tempDir = undefined
})

async function storeWith(contents: string) {
  tempDir = await mkdtemp(join(tmpdir(), "pig-models-config-"))
  const path = join(tempDir, "models.json")
  await writeFile(path, contents)
  return { store: new ProviderConfigStore(path), path }
}

describe("ProviderConfigStore", () => {
  it("只改目标键，未知顶层键与未知供应商键原样保留", async () => {
    const { store, path } = await storeWith(
      JSON.stringify({
        unknownTop: true,
        providers: {
          ollama: {
            name: "Ollama",
            baseUrl: "http://localhost:11434/v1",
            customField: { keep: true },
            models: [{ id: "llama3" }],
          },
        },
      }),
    )

    await store.mutate((config) => {
      const providers = config.providers as Record<string, Record<string, unknown>>

      providers.ollama = { ...providers.ollama, name: "本地 Ollama" }
    })

    const saved = JSON.parse(await readFile(path, "utf-8")) as {
      unknownTop: boolean
      providers: Record<string, Record<string, unknown>>
    }

    expect(saved.unknownTop).toBe(true)
    expect(saved.providers.ollama).toMatchObject({
      name: "本地 Ollama",
      customField: { keep: true },
      models: [{ id: "llama3" }],
    })
  })

  it("损坏的 JSON 抛 ModelsConfigError，且不写文件", async () => {
    const contents = "{ not json"
    const { store, path } = await storeWith(contents)

    await expect(store.mutate((config) => config)).rejects.toBeInstanceOf(ModelsConfigError)
    expect(await readFile(path, "utf-8")).toBe(contents)
  })

  it("写入后权限为 0600", async () => {
    const { store, path } = await storeWith("{}")

    await store.mutate((config) => {
      config.added = true
    })

    if (process.platform !== "win32") {
      expect((await stat(path)).mode & 0o777).toBe(0o600)
    }
  })

  it("并发 mutate 串行，两次写入都落盘", async () => {
    const { store, path } = await storeWith("{}")

    await Promise.all([
      store.mutate(async (config) => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        config.first = 1
      }),
      store.mutate((config) => {
        config.second = 2
      }),
    ])

    expect(JSON.parse(await readFile(path, "utf-8"))).toEqual({ first: 1, second: 2 })
  })
})
