import { randomUUID } from "node:crypto"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { defaultPigHome } from "@pig/environment"

const RENAME_ATTEMPTS = 4

export function pigHomeFile(filename: string, sessionDir?: string, pigHome?: string): string {
  if (pigHome) return join(pigHome, filename)

  if (sessionDir) return join(sessionDir, filename)
  return join(defaultPigHome(), filename)
}

async function renameAside(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if ((code !== "EPERM" && code !== "EBUSY") || attempt >= RENAME_ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)))
    }
  }
}

export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`

  await mkdir(dirname(path), { recursive: true })

  try {
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
    await renameAside(temp, path)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}
