import type { DefaultResourceLoader, EventBus } from "@earendil-works/pi-coding-agent"

import { canonicalizePath } from "../system/directory.js"
import { createResourceLoader } from "./resource-loader.js"

export type ResourceSlot = { loader: DefaultResourceLoader; taken: boolean }

const MAX_RESOURCE_SLOTS = 4

export interface WorkspaceResourcesOptions {
  agentDir?: string
  disabled: boolean
}

export class WorkspaceResources {
  private readonly slots = new Map<string, Promise<ResourceSlot>>()
  private disposed = false

  constructor(
    private readonly options: WorkspaceResourcesOptions,
    private readonly events: EventBus,
  ) {}

  prepare(workspace: string): void {
    if (this.options.disabled || this.disposed) return
    void this.slot(canonicalizePath(workspace)).catch(() => undefined)
  }

  async peek(workspace: string): Promise<ResourceSlot | undefined> {
    if (this.disposed) return undefined
    return this.slots.get(canonicalizePath(workspace))?.catch(() => undefined)
  }

  async take(cwd: string): Promise<DefaultResourceLoader | undefined> {
    if (this.options.disabled || this.disposed) return undefined

    const key = canonicalizePath(cwd)
    const pending = this.slot(key)
    const slot = await pending

    if (this.disposed) return undefined

    if (slot.taken) return createResourceLoader(key, this.options, this.events)
    slot.taken = true

    if (this.slots.get(key) === pending) this.slots.delete(key)

    if (!this.disposed) void this.slot(key).catch(() => undefined)
    return slot.loader
  }

  async dispose(): Promise<void> {
    this.disposed = true
    const pending = [...this.slots.values()]
    this.slots.clear()
    await Promise.allSettled(pending)
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

    if (!this.disposed) this.slots.set(cwd, pending)
    return pending
  }
}
