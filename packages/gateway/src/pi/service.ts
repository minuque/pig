import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  type EventBus,
} from "@earendil-works/pi-coding-agent"
import { defaultTaskLogRoot } from "@pig/environment"
import type {
  ComposerCommand,
  ContextPreviewKey,
  ContextUsageEstimate,
  DefaultModelView,
  ModelChannels,
  ModelMetadata,
  SessionCard,
  SessionMetadata,
  TranscriptItem,
} from "@pig/protocol"
import { GatewayError, SessionBusyError, SessionNotFoundError } from "./runtime-types.js"
import type { CreateSessionOptions, SessionService, SessionRuntime } from "./runtime-types.js"
import { canonicalizePath } from "../system/directory.js"
import { loadAuthorizedWorkspaces, saveAuthorizedWorkspaces } from "./authorized-workspaces.js"
import { AttachmentStore } from "./attachments.js"
import { selectComposerPrompts } from "./composer-commands.js"
import { ProviderService } from "./provider-service.js"
import { SessionCardCache } from "./session-card.js"
import { WorkspaceGitStore, workspaceGitFile } from "./workspace-git-store.js"
import { SessionIndex, type IndexedSession } from "./session-index.js"
import { recentSessionCwd, sessionListName } from "./session-label.js"
import { PiHostSession } from "./session-runtime.js"
import { SessionFileWatcher } from "./session-watcher.js"
import { TranscriptReader } from "./transcript-reader.js"
import { createDefaultRuntime, serializeEntries } from "./service-support.js"
import { isTurnUnfinished } from "./turn-state.js"
import { WorkspaceResources } from "./workspace-resources.js"

export type Runtime = Awaited<ReturnType<typeof ModelRuntime.create>>

type SessionFactory = typeof createAgentSession

const MODELS_CHANGED_CHANNEL = "pig:models:changed" satisfies keyof ModelChannels

export interface PiHostServiceOptions {
  sessionDir?: string
  pigHome?: string
  cwd?: string
  attachmentRootDir?: string
  agentDir?: string
  createRuntime?: () => Promise<Runtime>
  createSession?: SessionFactory
  events?: EventBus
}

export class PiHostService implements SessionService {
  readonly attachments: AttachmentStore
  readonly providers: ProviderService
  readonly workspaceGit: WorkspaceGitStore
  private readonly sessionPaths = new Map<string, string>()
  private readonly activeSessions = new Map<string, PiHostSession>()
  private readonly resources: WorkspaceResources
  private readonly events: EventBus
  onCatalogChange: (() => void) | undefined
  private authorizedLoad: Promise<Set<string>> | undefined
  private readonly knownWorkspaces = new Set<string>()
  private runtimePromise?: Promise<Runtime>
  private sessionsCache: { expiresAt: number; infos: IndexedSession[] } | undefined
  private readonly sessionIndex: SessionIndex
  private readonly cards = new SessionCardCache()
  private readonly transcripts = new TranscriptReader({
    live: (id) => this.activeSessions.get(id),
    findPath: (id) => this.findSessionPath(id),
  })
  private readonly fileWatcher = new SessionFileWatcher({
    resolvePath: (id) => this.findSessionPath(id),
  })

  constructor(private readonly options: PiHostServiceOptions = {}) {
    this.sessionIndex = new SessionIndex(options.sessionDir)
    this.workspaceGit = new WorkspaceGitStore(workspaceGitFile(options.sessionDir, options.pigHome))
    this.events = options.events ?? createEventBus()
    this.resources = new WorkspaceResources(
      {
        ...(options.agentDir ? { agentDir: options.agentDir } : {}),
        disabled: Boolean(options.createSession),
      },
      this.events,
    )
    this.attachments = new AttachmentStore(
      options.attachmentRootDir ? { rootDir: options.attachmentRootDir } : {},
    )
    this.providers = new ProviderService({
      runtime: () => this.modelRuntime(),
      onCatalogChange: () => {
        this.events.emit(MODELS_CHANGED_CHANNEL, undefined)
        this.catalogChanged()
      },
      ...(options.agentDir ? { agentDir: options.agentDir } : {}),
    })
  }

  modelRuntime(): Promise<Runtime> {
    return this.runtime()
  }

  catalogChanged(): void {
    this.onCatalogChange?.()
  }

  async listSessions(): Promise<SessionMetadata[]> {
    const infos = await this.refreshSessionPaths()
    return infos
      .flatMap((info) => (info.subagent ? [] : [info]))
      .map((info) => {
        const sessionName = sessionListName(info)
        return {
          id: info.id,
          createdAt: info.created.getTime(),
          ...(info.modified ? { updatedAt: info.modified.getTime() } : {}),
          ...(sessionName ? { sessionName } : {}),
          ...(info.cwd ? { cwd: canonicalizePath(info.cwd) } : {}),
        }
      })
  }

  async listSessionCards(): Promise<SessionCard[]> {
    this.sessionsCache = undefined
    const infos = await this.refreshSessionPaths()
    return this.cards.list(infos)
  }

  listModels(): Promise<{ models: ModelMetadata[]; defaultModel: DefaultModelView | null }> {
    return this.providers.listModels()
  }

  async warm(): Promise<void> {
    const [sessions] = await Promise.all([this.listSessions(), this.listModels()])
    const cwd = recentSessionCwd(sessions)

    if (cwd) this.prepareWorkspace(cwd)
  }

  prepareWorkspace(cwd: string): void {
    this.resources.prepare(cwd)
  }

  async authorizeWorkspace(cwd: string): Promise<void> {
    const key = canonicalizePath(cwd)
    const authorized = await (this.authorizedLoad ??= loadAuthorizedWorkspaces(
      this.options.sessionDir,
      this.options.pigHome,
    ).then((paths) => new Set(paths)))

    if (authorized.has(key)) return
    authorized.add(key)
    this.knownWorkspaces.add(key)

    await saveAuthorizedWorkspaces(this.options.sessionDir, authorized, this.options.pigHome).catch(
      () => undefined,
    )
  }

  async isKnownWorkspace(cwd: string): Promise<boolean> {
    const key = canonicalizePath(cwd)

    if (this.knownWorkspaces.has(key)) return true

    const authorized = await (this.authorizedLoad ??= loadAuthorizedWorkspaces(
      this.options.sessionDir,
      this.options.pigHome,
    ).then((paths) => new Set(paths)))

    if (authorized.has(key)) {
      this.knownWorkspaces.add(key)
      return true
    }

    for (const session of this.activeSessions.values()) {
      if (session.cwd === key) {
        this.knownWorkspaces.add(key)
        return true
      }
    }

    const sessions = await this.refreshSessionPaths()
    const hit = sessions.some((info) => info.cwd && canonicalizePath(info.cwd) === key)

    if (hit) this.knownWorkspaces.add(key)
    return hit
  }

  async workspaceCommands(
    cwd: string,
  ): Promise<{ skills: ComposerCommand[]; prompts: ComposerCommand[] }> {
    if (this.options.createSession) return { skills: [], prompts: [] }
    const key = canonicalizePath(cwd)
    const live = [...this.activeSessions.values()].find((session) => session.cwd === key)
    const slot = live ? { loader: live.loader } : await this.resources.peek(key)

    if (!slot) return { skills: [], prompts: [] }
    const reserved = new Set<string>()

    for (const extension of slot.loader.getExtensions().extensions) {
      for (const name of extension.commands.keys()) reserved.add(name)
    }

    return {
      skills: slot.loader
        .getSkills()
        .skills.map((skill) => ({ name: skill.name, description: skill.description })),
      prompts: selectComposerPrompts(
        slot.loader.getPrompts().prompts.map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          ...(prompt.argumentHint === undefined ? {} : { argumentHint: prompt.argumentHint }),
        })),
        reserved,
      ),
    }
  }

  async createSession(options: CreateSessionOptions): Promise<SessionRuntime> {
    const runtime = await this.runtime()
    const cwd = canonicalizePath(options.cwd ?? this.options.cwd ?? process.cwd())
    const manager = SessionManager.create(cwd, this.options.sessionDir, { id: options.id })

    if (options.name) manager.appendSessionInfo(options.name)
    const path = manager.getSessionFile()
    const header = manager.getHeader()

    if (!path || !header) throw new Error("Pi did not create a persistent session")

    // 外部：Pi 仅在出现助手消息后写文件，也没有 ensurePersisted API；这里立即落盘 header 保证 id 持久化，再回读校验
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, serializeEntries(header, manager.getEntries()), { flag: "wx" })

    if (SessionManager.open(path).getHeader()?.id !== options.id) {
      await rm(path, { force: true })
      throw new Error("Pi session persistence format validation failed")
    }

    this.sessionsCache = undefined
    this.sessionPaths.set(options.id, path)

    const model = options.model
      ? runtime.getModel(options.model.provider, options.model.id)
      : undefined

    if (options.model && !model) {
      await this.rollbackSession(options.id, path)
      throw new GatewayError(
        "invalid_request",
        `Model ${options.model.provider}/${options.model.id} is unavailable`,
      )
    }

    let loader: DefaultResourceLoader | undefined

    try {
      loader = await this.resources.take(cwd)

      const { session } = await this.sessionFactory()({
        cwd,
        modelRuntime: runtime,
        sessionManager: SessionManager.open(path),
        ...(loader ? { resourceLoader: loader } : {}),
        ...(model ? { model } : {}),
        ...(options.thinkingLevel ? { thinkingLevel: options.thinkingLevel } : {}),
      })
      return await this.trackSession(session)
    } catch (error) {
      await this.rollbackSession(options.id, path)
      throw error
    }
  }

  async renameSession(sessionId: string, name: string): Promise<void> {
    const trimmed = name.trim()

    if (!trimmed) throw new GatewayError("invalid_request", "会话名不能为空")

    const live = this.activeSessions.get(sessionId)

    if (live) {
      live.setSessionName(trimmed)
      this.sessionsCache = undefined
      this.catalogChanged()
      return
    }

    const path = await this.findSessionPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)
    SessionManager.open(path).appendSessionInfo(trimmed)
    this.sessionsCache = undefined
    this.catalogChanged()
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (this.activeSessions.has(sessionId)) throw new SessionBusyError("Session is still open")
    const path = await this.findSessionPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)
    await rm(path, { force: true })
    await rm(join(defaultTaskLogRoot(), sessionId), { recursive: true, force: true })
    this.sessionPaths.delete(sessionId)
    this.sessionsCache = undefined
    this.catalogChanged()
  }

  async dispose(): Promise<void> {
    this.providers.dispose()
    this.fileWatcher.close()
    await Promise.all([
      this.attachments.dispose(),
      this.resources.dispose(),
      this.workspaceGit.close(),
    ])
  }

  watchSession(sessionId: string, listener: () => void): () => void {
    return this.fileWatcher.subscribe(sessionId, listener)
  }

  async openSession(
    sessionId: string,
    options: { takeover?: boolean } = {},
  ): Promise<SessionRuntime> {
    const runtime = await this.runtime()
    const path = await this.findSessionPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)

    const manager = SessionManager.open(path)

    if (!options.takeover && isTurnUnfinished(manager.getBranch())) {
      throw new GatewayError("session_locked", `Session ${sessionId} has a turn running elsewhere`)
    }

    // 外部：与 createSession 同一套规范化拼写，SDK 的扩展缓存才不会被会话文件的原生拼写顶掉
    const cwd = canonicalizePath(manager.getCwd())
    const loader = await this.resources.take(cwd)
    const { session } = await this.sessionFactory()({
      cwd,
      modelRuntime: runtime,
      sessionManager: manager,
      ...(loader ? { resourceLoader: loader } : {}),
    })
    return await this.trackSession(session)
  }

  contextUsage(
    sessionId: string,
    previewKey?: ContextPreviewKey,
  ): ContextUsageEstimate | undefined {
    return this.activeSessions.get(sessionId)?.contextUsage(previewKey)
  }

  sessionTranscript(...args: Parameters<TranscriptReader["page"]>) {
    return this.transcripts.page(...args)
  }

  transcriptItem(sessionId: string, itemId: string): Promise<TranscriptItem | undefined> {
    return this.transcripts.item(sessionId, itemId)
  }

  private async refreshSessionPaths(): Promise<IndexedSession[]> {
    const now = Date.now()

    if (this.sessionsCache && this.sessionsCache.expiresAt > now) return this.sessionsCache.infos

    const infos = await this.sessionIndex.list()
    this.sessionPaths.clear()

    for (const info of infos) this.sessionPaths.set(info.id, info.path)
    this.sessionsCache = { expiresAt: now + 2_000, infos }
    void this.workspaceGit.track([
      ...new Set(infos.flatMap((info) => (info.cwd ? [canonicalizePath(info.cwd)] : []))),
    ])
    return infos
  }

  private async findSessionPath(sessionId: string): Promise<string | undefined> {
    const cached = this.sessionPaths.get(sessionId)

    if (cached) return cached
    await this.refreshSessionPaths()
    return this.sessionPaths.get(sessionId)
  }

  private runtime(): Promise<Runtime> {
    return (this.runtimePromise ??= this.options.createRuntime
      ? this.options.createRuntime()
      : createDefaultRuntime(this.options.agentDir))
  }

  private sessionFactory(): SessionFactory {
    return this.options.createSession ?? createAgentSession
  }

  private async trackSession(
    session: Awaited<ReturnType<SessionFactory>>["session"],
  ): Promise<PiHostSession> {
    let host!: PiHostSession
    host = new PiHostSession(
      session,
      () => {
        if (this.activeSessions.get(session.sessionId) === host) {
          this.activeSessions.delete(session.sessionId)
        }
      },
      this.attachments,
      this.events,
    )
    this.activeSessions.set(session.sessionId, host)

    try {
      await host.bindExtensions()
    } catch (error) {
      await host.dispose()
      throw error
    }

    return host
  }

  private async rollbackSession(sessionId: string, path: string): Promise<void> {
    this.sessionsCache = undefined
    this.sessionPaths.delete(sessionId)
    await rm(path, { force: true })
  }
}
