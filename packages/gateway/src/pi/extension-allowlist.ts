import type { ResolvedResource } from "@earendil-works/pi-coding-agent"
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { resolve, sep } from "node:path"

export const defaultExtensionsFile = () => resolve(homedir(), ".pig", "extensions.json")
/** 同一份坏文件只在日志里报一次。 */
const reported = new Set<string>()

/** 读放行清单：文件缺失或格式不对一律当空，格式不对报一次。 */
export async function readExtensionAllowlist(file = defaultExtensionsFile()): Promise<string[]> {
  let text: string

  try {
    text = await readFile(file, "utf-8")
  } catch {
    return []
  }

  try {
    const enabled: unknown = (JSON.parse(text) as { enabled?: unknown } | null)?.enabled

    if (!Array.isArray(enabled) || !enabled.every((item) => typeof item === "string")) {
      throw new Error('应为 { "enabled": string[] }')
    }

    return enabled
  } catch (error) {
    const message = `${file}: ${error instanceof Error ? error.message : String(error)}`

    if (!reported.has(message)) {
      reported.add(message)
      console.error("Gateway extensions allowlist ignored:", message)
    }

    return []
  }
}

const pathKey = (path: string) => {
  const full = resolve(path)
  return process.platform === "win32" ? full.toLowerCase() : full
}

/** 包来的扩展按 settings.json 里的来源字符串匹配；目录下的扩展按文件或所在目录匹配。 */
export function isAllowed(resource: ResolvedResource, allowlist: string[]): boolean {
  if (resource.metadata.origin === "package") return allowlist.includes(resource.metadata.source)

  const path = pathKey(resource.path)
  return allowlist.some((entry) => {
    const key = pathKey(entry)
    return path === key || path.startsWith(key.endsWith(sep) ? key : key + sep)
  })
}
