import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath, URL } from "node:url"

const webRoot = dirname(fileURLToPath(import.meta.url))
const MOCK_PATTERN = /\bvi\.(?:do)?[Mm]ock\s*\(/

export const webAliases = {
  "@pig/protocol": fileURLToPath(new URL("../../packages/protocol/src/index.ts", import.meta.url)),
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@style": fileURLToPath(new URL("./src/style", import.meta.url)),
  "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
  "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
  "@client": fileURLToPath(new URL("./src/client", import.meta.url)),
  "@router": fileURLToPath(new URL("./src/router", import.meta.url)),
  "@i18n": fileURLToPath(new URL("./src/i18n", import.meta.url)),
  "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
}

export function findMockedWebTests(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)

      if (entry.isDirectory()) walk(full)
      else if (/\.test\.ts$/.test(entry.name) && MOCK_PATTERN.test(readFileSync(full, "utf8")))
        out.push(relative(webRoot, full).replaceAll("\\", "/"))
    }
  }

  walk(join(webRoot, "test"))
  return out
}
