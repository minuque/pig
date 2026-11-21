import {
  createCodemodeExtension,
  createMcpExtension,
  createToolSearchExtension,
  DefaultResourceLoader,
  getAgentDir,
  SettingsManager,
  type EventBus,
} from "@earendil-works/pi-coding-agent"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

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
      "subagent",
      "remote-workspace",
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

function settingsWithoutPackages(cwd: string, agentDir: string): SettingsManager {
  const settings = SettingsManager.create(cwd, agentDir)
  const global = settings.getGlobalSettings.bind(settings)
  const project = settings.getProjectSettings.bind(settings)
  settings.getGlobalSettings = () => ({ ...global(), packages: [] })
  settings.getProjectSettings = () => ({ ...project(), packages: [] })
  return settings
}
