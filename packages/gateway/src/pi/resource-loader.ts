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

/** pig 内置的 pi 包；和用户装的扩展一样由 pi 加载，pig 不给它开私有接口。 */
const BUILTIN_PACKAGE = dirname(
  createRequire(import.meta.url).resolve("@pig/extensions/package.json"),
)

export interface ResourceLoaderOptions {
  /** Pi 配置目录；缺省 ~/.pi/agent。 */
  agentDir?: string
}

/** 新建并 reload 一份 loader；同拼写下 SDK 复用扩展模块缓存，不重复转译。 */
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
    // 扩展间的公开事件总线；宿主也挂在上面收后台任务、发停止请求
    ...(eventBus ? { eventBus } : {}),
    // 用户在 pi 里装的扩展一律不执行，只加回内置的
    noExtensions: true,
    additionalExtensionPaths: [
      "turn-timing",
      "file-mentions",
      "subagent",
      "remote-workspace",
      "tasks",
    ].map((name) => join(BUILTIN_PACKAGE, "src", name, "index.ts")),
    // CLI 内置的这三个扩展 SDK 不会自带；照 CLI 加上，启用与否仍由用户的 pi 设置决定
    extensionFactories: [
      createCodemodeExtension(),
      createToolSearchExtension(),
      createMcpExtension(),
    ],
  })

  await loader.reload()
  return loader
}

/** 仓库的 .pi/settings.json 不读，本机设置藏起 packages：pi 看不到包，就不加载也不替用户安装。 */
function settingsWithoutPackages(cwd: string, agentDir: string): SettingsManager {
  const settings = SettingsManager.create(cwd, agentDir, { projectTrusted: false })
  const global = settings.getGlobalSettings.bind(settings)
  // 只有 pi 的包增删会拿这份去回写，pig 不调用它们
  settings.getGlobalSettings = () => ({ ...global(), packages: [] })
  return settings
}
