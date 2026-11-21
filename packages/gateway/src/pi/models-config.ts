import { randomUUID } from "node:crypto"
import { chmod, readFile, rename, writeFile } from "node:fs/promises"

export class ModelsConfigError extends Error {
  constructor(message = "models.json 无法解析") {
    super(message)
  }
}

export class ProviderConfigStore {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(readonly path: string) {}

  async read(): Promise<Record<string, unknown>> {
    let text: string

    try {
      text = await readFile(this.path, "utf-8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}
      throw error
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ModelsConfigError()
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new ModelsConfigError()
    return parsed as Record<string, unknown>
  }

  mutate<T>(change: (config: Record<string, unknown>) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const config = await this.read()
      const result = await change(config)

      await this.write(config)
      return result
    })

    this.queue = run.catch(() => undefined)
    return run
  }

  private async write(config: Record<string, unknown>): Promise<void> {
    const temp = `${this.path}.${randomUUID()}.tmp`

    await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
    await chmod(temp, 0o600)
    await rename(temp, this.path)
  }
}
