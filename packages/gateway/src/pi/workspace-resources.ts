import type { DefaultResourceLoader, EventBus } from "@earendil-works/pi-coding-agent"

import { canonicalizePath } from "../system/directory.js"
import { parseRemoteKey, prepareRemoteCwd } from "./remote-session.js"
import { createResourceLoader } from "./resource-loader.js"

/** 已 reload 的资源加载器；只交给一个会话，会话 dispose 后其扩展运行时即失效。 */
export type ResourceSlot = { loader: DefaultResourceLoader; taken: boolean }

const MAX_RESOURCE_SLOTS = 4

export interface WorkspaceResourcesOptions {
  /** Pi 配置目录；缺省 ~/.pi/agent。 */
  agentDir?: string
  /** 远程会话的本地占位目录根；缺省 ~/.pig/remote。 */
  remoteRoot?: string
  /** 测试注入了 AgentSession 工厂：不加载真实 loader。 */
  disabled: boolean
}

/** 目录 → loader 的缓存：每个目录一份，预热与会话共用；远程 workspace 键换成占位目录。 */
export class WorkspaceResources {
  private readonly slots = new Map<string, Promise<ResourceSlot>>()

  constructor(
    private readonly options: WorkspaceResourcesOptions,
    private readonly events: EventBus,
  ) {}

  /** workspace 键对应的本地 cwd：远程键换成占位目录。 */
  async localCwd(workspace: string): Promise<string> {
    const binding = parseRemoteKey(workspace)
    return canonicalizePath(
      binding ? await prepareRemoteCwd(binding, this.options.remoteRoot) : workspace,
    )
  }

  /** 预热：只备好 loader，不授予目录权限；调用方需先校验目录。 */
  prepare(workspace: string): void {
    if (this.options.disabled) return
    void this.localCwd(workspace)
      .then((local) => this.slot(local))
      .catch(() => undefined)
  }

  /** 已备好的 slot：只读命令列表时用它，不为未知目录新建。 */
  async peek(workspace: string): Promise<ResourceSlot | undefined> {
    return this.slots.get(await this.localCwd(workspace))?.catch(() => undefined)
  }

  /** 取该目录预热好的 loader 交给会话，并在后台为下一个会话预热一份新的。 */
  async take(cwd: string): Promise<DefaultResourceLoader | undefined> {
    if (this.options.disabled) return undefined

    const key = canonicalizePath(cwd)
    const pending = this.slot(key)
    const slot = await pending

    if (slot.taken) return createResourceLoader(key, this.options, this.events)
    slot.taken = true

    if (this.slots.get(key) === pending) this.slots.delete(key)
    void this.slot(key).catch(() => undefined)
    return slot.loader
  }

  /** 每个目录一份 loader；并发请求共用同一次加载，超上限按插入顺序淘汰一项。 */
  private slot(cwd: string): Promise<ResourceSlot> {
    const cached = this.slots.get(cwd)

    if (cached) return cached

    if (this.slots.size >= MAX_RESOURCE_SLOTS) {
      const oldest = this.slots.keys().next()

      if (!oldest.done) this.slots.delete(oldest.value)
    }

    const pending = createResourceLoader(cwd, this.options, this.events).then(
      (loader) => ({ loader, taken: false }),
      (error: unknown) => {
        this.slots.delete(cwd)
        throw error
      },
    )

    this.slots.set(cwd, pending)
    return pending
  }
}
