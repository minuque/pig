import type { DefaultResourceLoader, EventBus } from "@earendil-works/pi-coding-agent"

import { canonicalizePath } from "../system/directory.js"
import { parseRemoteKey, prepareRemoteCwd } from "./remote-session.js"
import { createResourceLoader } from "./resource-loader.js"

export type ResourceSlot = { loader: DefaultResourceLoader; taken: boolean }

const MAX_RESOURCE_SLOTS = 4

export interface WorkspaceResourcesOptions {
  agentDir?: string
  remoteRoot?: string
  disabled: boolean
}

export class WorkspaceResources {
  private readonly slots = new Map<string, Promise<ResourceSlot>>()

  constructor(
    private readonly options: WorkspaceResourcesOptions,
    private readonly events: EventBus,
  ) {}

  async localCwd(workspace: string): Promise<string> {
    const binding = parseRemoteKey(workspace)
    return canonicalizePath(
      binding ? await prepareRemoteCwd(binding, this.options.remoteRoot) : workspace,
    )
  }

  prepare(workspace: string): void {
    if (this.options.disabled) return
    void this.localCwd(workspace)
      .then((local) => this.slot(local))
      .catch(() => undefined)
  }

  async peek(workspace: string): Promise<ResourceSlot | undefined> {
    return this.slots.get(await this.localCwd(workspace))?.catch(() => undefined)
  }

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
