import { watch, type FSWatcher } from "node:fs"
import { readFile } from "node:fs/promises"
import { basename, dirname } from "node:path"
import type { WorkspaceGit } from "@pig/protocol"
import { pigHomeFile, writeJsonAtomic } from "../system/pig-file.js"
import { readWorkspaceGitHead } from "./workspace-git.js"

export type WorkspaceGitChanges = Record<string, WorkspaceGit | null>

interface HeadWatch {
  watcher: FSWatcher
  workspaces: Set<string>
  timer: NodeJS.Timeout | undefined
}

export function workspaceGitFile(sessionDir?: string, pigHome?: string): string {
  return pigHomeFile("workspace-git.json", sessionDir, pigHome)
}

function isWorkspaceGit(value: unknown): value is WorkspaceGit {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.branch === "string" &&
    typeof item.detached === "boolean" &&
    typeof item.worktree === "boolean"
  )
}

function sameGit(a: WorkspaceGit | undefined, b: WorkspaceGit | undefined): boolean {
  return a?.branch === b?.branch && a?.detached === b?.detached && a?.worktree === b?.worktree
}

export class WorkspaceGitStore {
  private readonly cache = new Map<string, WorkspaceGit>()
  private readonly tracked = new Set<string>()
  private readonly heads = new Map<string, HeadWatch>()
  private readonly headOf = new Map<string, string>()
  private readonly reading = new Map<string, Promise<void>>()
  private readonly queued = new Map<string, Promise<void>>()
  private readonly listeners = new Set<(changes: WorkspaceGitChanges) => void>()
  private pending: WorkspaceGitChanges = {}
  private writeTimer: NodeJS.Timeout | undefined
  private writing: Promise<void> = Promise.resolve()
  private dirty = false
  private closed = false
  private readonly debounceMs: number
  private readonly writeDelayMs: number

  constructor(
    private readonly path: string,
    options: { debounceMs?: number; writeDelayMs?: number } = {},
  ) {
    this.debounceMs = options.debounceMs ?? 100
    this.writeDelayMs = options.writeDelayMs ?? 500
  }

  async load(): Promise<void> {
    const raw: unknown = await readFile(this.path, "utf8")
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => undefined)

    if (typeof raw !== "object" || raw === null) return
    const { version, workspaces } = raw as Record<string, unknown>

    if (
      version !== 1 ||
      typeof workspaces !== "object" ||
      workspaces === null ||
      Array.isArray(workspaces)
    )
      return

    for (const [workspace, git] of Object.entries(workspaces))
      if (isWorkspaceGit(git) && !this.cache.has(workspace)) this.cache.set(workspace, git)
  }

  snapshot(): Record<string, WorkspaceGit> {
    return Object.fromEntries(this.cache)
  }

  onChange(listener: (changes: WorkspaceGitChanges) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async track(workspaces: readonly string[]): Promise<void> {
    if (this.closed) return
    const next = new Set(workspaces)

    for (const workspace of new Set([...this.tracked, ...this.cache.keys()]))
      if (!next.has(workspace)) this.forget(workspace)

    const added = [...next].filter((workspace) => !this.tracked.has(workspace))

    for (const workspace of added) this.tracked.add(workspace)
    await this.readAll(added)
  }

  refresh(workspaces?: readonly string[]): Promise<void> {
    if (this.closed) return Promise.resolve()

    const unwatched = [...this.tracked].filter((item) => !this.headOf.has(item))
    const targets = (workspaces ?? unwatched).filter((workspace) => this.tracked.has(workspace))
    return this.readAll(targets)
  }

  async close(): Promise<void> {
    this.closed = true

    for (const head of this.heads.values()) {
      clearTimeout(head.timer)
      head.watcher.close()
    }

    this.heads.clear()
    this.headOf.clear()
    clearTimeout(this.writeTimer)
    this.writeTimer = undefined

    if (this.dirty) this.persist()
    await this.writing
  }

  private async readAll(workspaces: readonly string[]): Promise<void> {
    await Promise.all(workspaces.map((workspace) => this.read(workspace)))
    this.flush()
  }

  private read(workspace: string): Promise<void> {
    const running = this.reading.get(workspace)

    if (running) {
      const queued =
        this.queued.get(workspace) ??
        running.then(() => {
          this.queued.delete(workspace)
          return this.read(workspace)
        })

      this.queued.set(workspace, queued)
      return queued
    }

    const run = this.readNow(workspace).finally(() => this.reading.delete(workspace))
    this.reading.set(workspace, run)
    return run
  }

  private async readNow(workspace: string): Promise<void> {
    const head = await readWorkspaceGitHead(workspace).catch(() => undefined)

    if (this.closed || !this.tracked.has(workspace)) return

    if (head) this.watchHead(workspace, head.headPath)
    else this.unwatch(workspace)

    if (sameGit(this.cache.get(workspace), head?.git)) return

    if (head) this.cache.set(workspace, head.git)
    else this.cache.delete(workspace)
    this.pending[workspace] = head?.git ?? null
    this.scheduleWrite()
  }

  private flush() {
    if (this.closed || Object.keys(this.pending).length === 0) return
    const changes = this.pending
    this.pending = {}

    for (const listener of this.listeners) listener(changes)
  }

  private forget(workspace: string) {
    this.tracked.delete(workspace)
    this.unwatch(workspace)
    delete this.pending[workspace]

    if (this.cache.delete(workspace)) this.scheduleWrite()
  }

  private watchHead(workspace: string, headPath: string) {
    if (this.headOf.get(workspace) === headPath) return
    this.unwatch(workspace)
    const existing = this.heads.get(headPath)

    if (existing) {
      existing.workspaces.add(workspace)
      this.headOf.set(workspace, headPath)
      return
    }

    const name = basename(headPath).toLowerCase()
    let watcher: FSWatcher

    try {
      watcher = watch(dirname(headPath), (_event, filename) => {
        if (filename && filename.toString().toLowerCase() !== name) return
        this.scheduleHead(headPath)
      })
    } catch {
      return
    }

    const head: HeadWatch = { watcher, workspaces: new Set([workspace]), timer: undefined }
    watcher.on("error", () => {
      if (this.heads.get(headPath) !== head) return
      const affected = [...head.workspaces]
      this.closeHead(headPath)
      void this.refresh(affected)
    })
    watcher.unref()
    this.heads.set(headPath, head)
    this.headOf.set(workspace, headPath)
    this.scheduleHead(headPath)
  }

  private scheduleHead(headPath: string) {
    const head = this.heads.get(headPath)

    if (!head || head.timer) return
    head.timer = setTimeout(() => {
      head.timer = undefined

      if (this.heads.get(headPath) === head) void this.refresh([...head.workspaces])
    }, this.debounceMs)
    head.timer.unref()
  }

  private unwatch(workspace: string) {
    const headPath = this.headOf.get(workspace)

    if (!headPath) return
    this.headOf.delete(workspace)
    const head = this.heads.get(headPath)

    if (!head) return
    head.workspaces.delete(workspace)

    if (head.workspaces.size === 0) this.closeHead(headPath)
  }

  private closeHead(headPath: string) {
    const head = this.heads.get(headPath)

    if (!head) return
    this.heads.delete(headPath)
    clearTimeout(head.timer)
    head.watcher.close()

    for (const workspace of head.workspaces) this.headOf.delete(workspace)
  }

  private scheduleWrite() {
    this.dirty = true

    if (this.closed || this.writeTimer) return
    this.writeTimer = setTimeout(() => {
      this.writeTimer = undefined
      this.persist()
    }, this.writeDelayMs)
    this.writeTimer.unref()
  }

  private persist() {
    this.dirty = false
    const data = { version: 1, workspaces: this.snapshot() }
    this.writing = this.writing
      .then(() => writeJsonAtomic(this.path, data))
      .catch((error) => console.error("workspace-git write failed:", error))
  }
}
