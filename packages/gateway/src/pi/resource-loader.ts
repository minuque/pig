import {
  CONFIG_DIR_NAME,
  createCodemodeExtension,
  createMcpExtension,
  createToolSearchExtension,
  DefaultResourceLoader,
  getAgentDir,
  SettingsManager,
  type EventBus,
} from "@earendil-works/pi-coding-agent"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

const BUILTIN_PACKAGE = dirname(
  createRequire(import.meta.url).resolve("@pig/extensions/package.json"),
)

export interface ResourceLoaderOptions {
  agentDir?: string
}

// 外部：同拼写下 SDK 复用扩展模块缓存，不重复转译
export async function createResourceLoader(
  cwd: string,
  options: ResourceLoaderOptions = {},
  eventBus?: EventBus,
): Promise<DefaultResourceLoader> {
  const agentDir = options.agentDir ?? getAgentDir()
  const settingsManager = settingsWithoutPackages(cwd, agentDir)
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    ...(eventBus ? { eventBus } : {}),
    noExtensions: true,
    additionalExtensionPaths: [
      "turn-timing",
      "file-mentions",
      "context-references",
      "subagent",
      "tasks",
    ].map((name) => join(BUILTIN_PACKAGE, "src", name, "index.ts")),
    // 外部：CLI 内置的这三个扩展 SDK 不会自带；照 CLI 加上，启用与否仍由用户的 pi 设置决定
    extensionFactories: [
      createCodemodeExtension(),
      createToolSearchExtension(),
      createMcpExtension(),
    ],
  })

  await loader.reload()
  return loader
}

function stripPackagesFromSettingsJson(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined

  try {
    const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    const parsed: unknown = JSON.parse(clean)

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return raw
    const { packages: _packages, ...rest } = parsed as Record<string, unknown>
    return JSON.stringify(rest)
  } catch {
    return raw
  }
}

export function settingsWithoutPackages(cwd: string, agentDir: string): SettingsManager {
  const globalPath = join(resolve(agentDir), "settings.json")
  const projectPath = join(resolve(cwd), CONFIG_DIR_NAME, "settings.json")
  const settings = SettingsManager.fromStorage({
    withLock(scope, fn) {
      const path = scope === "global" ? globalPath : projectPath
      const current = existsSync(path)
        ? stripPackagesFromSettingsJson(readFileSync(path, "utf-8"))
        : undefined

      fn(current)
    },
  })

  if (
    (settings.getGlobalSettings().packages?.length ?? 0) > 0 ||
    (settings.getProjectSettings().packages?.length ?? 0) > 0 ||
    settings.getPackages().length > 0
  ) {
    throw new Error("SettingsManager unexpectedly retained packages")
  }

  return settings
}
