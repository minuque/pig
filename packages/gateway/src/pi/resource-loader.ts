import {
  createCodemodeExtension,
  createMcpExtension,
  createToolSearchExtension,
  DefaultPackageManager,
  DefaultResourceLoader,
  getAgentDir,
  SettingsManager,
  type EventBus,
} from "@earendil-works/pi-coding-agent"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { isAllowed, readExtensionAllowlist } from "./extension-allowlist.js"

/** pig 内置的 pi 包；和用户装的扩展一样由 pi 加载，pig 不给它开私有接口。 */
const BUILTIN_PACKAGE = dirname(
  createRequire(import.meta.url).resolve("@pig/extensions/package.json"),
)

export interface ResourceLoaderOptions {
  /** Pi 配置目录；缺省 ~/.pi/agent。 */
  agentDir?: string
  /** 用户扩展放行清单；缺省 ~/.pig/extensions.json。 */
  extensionsFile?: string
}

/** 新建并 reload 一份 loader；同拼写下 SDK 复用扩展模块缓存，不重复转译。 */
export async function createResourceLoader(
  cwd: string,
  options: ResourceLoaderOptions = {},
  eventBus?: EventBus,
): Promise<DefaultResourceLoader> {
  const agentDir = options.agentDir ?? getAgentDir()
  const settingsManager = SettingsManager.create(cwd, agentDir)
  const allowlist = readExtensionAllowlist(options.extensionsFile)
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    // 扩展间的公开事件总线；宿主也挂在上面收后台任务、发停止请求
    ...(eventBus ? { eventBus } : {}),
    // 用户在 pi 里装的扩展默认不执行，只加回内置与放行的
    noExtensions: true,
    additionalExtensionPaths: [
      ...["turn-timing", "file-mentions", "subagent", "remote-workspace", "tasks"].map((name) =>
        join(BUILTIN_PACKAGE, "src", name, "index.ts"),
      ),
      // 清单为空时不 await：多让出一拍，后台预热的 reload 会压到刚发来的 prompt 后面
      ...(allowlist.length
        ? await allowedExtensionPaths(cwd, agentDir, settingsManager, allowlist)
        : []),
    ],
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

/** 用 SDK 解析出 pi 设置里启用的扩展，只留放行清单里的；解析本身不执行扩展代码。 */
async function allowedExtensionPaths(
  cwd: string,
  agentDir: string,
  settingsManager: SettingsManager,
  allowlist: string[],
): Promise<string[]> {
  const { extensions } = await new DefaultPackageManager({
    cwd,
    agentDir,
    settingsManager,
  }).resolve()
  return extensions.filter((r) => r.enabled && isAllowed(r, allowlist)).map((r) => r.path)
}
