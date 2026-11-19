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
import { SessionIndex, type IndexedSession } from "./session-index.js"
import { recentSessionCwd, sessionListName } from "./session-label.js"
import { BINDING_ENTRY, parseRemoteKey } from "./remote-session.js"
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
  /** 统一会话目录；缺省用 Pi 默认（~/.pi/agent/sessions/<cwd>/）。 */
  sessionDir?: string
  /** 默认工作目录（createSession 未指定 cwd 时使用）。 */
  cwd?: string
  /** 非图片附件的临时根目录；缺省 os.tmpdir()/pig-attachments。 */
  attachmentRootDir?: string
  /** Pi 配置目录（auth.json / models.json / settings.json）；缺省 ~/.pi/agent。 */
  agentDir?: string
  /** 远程会话的本地占位目录根；缺省 ~/.pig/remote。 */
  remoteRoot?: string
  /** 测试注入：ModelRuntime 工厂。 */
  createRuntime?: () => Promise<Runtime>
  /** 测试注入：AgentSession 工厂。 */
  createSession?: SessionFactory
  /** 测试注入：扩展事件总线。 */
  events?: EventBus
}

/**
 * 把 Pi SDK（SessionManager + AgentSession + ModelRuntime）映射为官方
 * SessionService。会话真相以 Pi 持久化为准，本类不维护第二套领域状态。
 */
export class PiHostService implements SessionService {
  /** 附件暂存：平台 HTTP 与 prompt 消费共用同一份。 */
  readonly attachments: AttachmentStore
  /** 供应商投影、登录与 models.json 写入。 */
  readonly providers: ProviderService
  /** sessionId → 会话文件路径（listSessions/openSession 时填充）。 */
  private readonly sessionPaths = new Map<string, string>()
  private readonly activeSessions = new Map<string, PiHostSession>()
  /** 规范化 cwd → 该目录已 reload 的 loader。 */
  private readonly resources: WorkspaceResources
  /** 所有会话的扩展共用一条事件总线；后台任务按会话 id 区分。 */
  private readonly events: EventBus
  /** 会话目录或模型目录变了：Gateway 据此广播服务快照。 */
  onCatalogChange: (() => void) | undefined
  /** 用户选过的目录（懒加载）；见 authorizedWorkspacesFile。 */
  private authorizedLoad: Promise<Set<string>> | undefined
  /** 已判定为已知的目录（含靠磁盘会话命中的），免每次重扫会话。 */
  private readonly knownWorkspaces = new Set<string>()
  private runtimePromise?: Promise<Runtime>
  private sessionsCache: { expiresAt: number; infos: IndexedSession[] } | undefined
  private readonly sessionIndex: SessionIndex
  private readonly cards = new SessionCardCache()
  private readonly transcripts = new TranscriptReader({
    live: (id) => this.activeSessions.get(id),
    findPath: (id) => this.findSessionPath(id),
  })
  /** 按需会话文件监听：watch_session 的落点，没有订阅者时不开句柄。 */
  private readonly fileWatcher = new SessionFileWatcher({
    resolvePath: (id) => this.findSessionPath(id),
  })

  constructor(private readonly options: PiHostServiceOptions = {}) {
    this.sessionIndex = new SessionIndex(options.sessionDir)
    this.events = options.events ?? createEventBus()
    this.resources = new WorkspaceResources(
      {
        ...(options.agentDir ? { agentDir: options.agentDir } : {}),
        ...(options.remoteRoot ? { remoteRoot: options.remoteRoot } : {}),
        disabled: Boolean(options.createSession),
      },
      this.events,
    )
    this.attachments = new AttachmentStore(
      options.attachmentRootDir ? { rootDir: options.attachmentRootDir } : {},
    )
    this.providers = new ProviderService({
      runtime: () => this.modelRuntime(),
      // 供应商配置、凭据与模型目录变了：扩展重建缓存的运行时，协议端广播新快照
      onCatalogChange: () => {
        this.events.emit(MODELS_CHANGED_CHANNEL, undefined)
        this.catalogChanged()
      },
      ...(options.agentDir ? { agentDir: options.agentDir } : {}),
    })
  }

  /** 供应商路由与登录流程共用同一个惰性 runtime 实例。 */
  modelRuntime(): Promise<Runtime> {
    return this.runtime()
  }

  /** 目录变了（会话重命名/删除、供应商配置）：通知 Gateway 广播服务快照。 */
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

  /**
   * 侧栏卡片投影：消息数与结果来自当前分支，模型来自最后一次 model_change；按文件版本缓存。
   * 不进协议 SessionMetadata（strict，会丢掉额外字段）。
   */
  async listSessionCards(): Promise<SessionCard[]> {
    this.sessionsCache = undefined
    const infos = await this.refreshSessionPaths()
    return this.cards.list(infos)
  }

  async listModels(): Promise<ModelMetadata[]> {
    return (await this.providers.listModels()).models
  }

  /** 监听前预热会话列表、模型目录和最近用过的会话目录，避免首次握手与首次建会话超时。 */
  async warm(): Promise<void> {
    const [sessions] = await Promise.all([this.listSessions(), this.listModels()])
    const cwd = recentSessionCwd(sessions)

    if (cwd) this.prepareWorkspace(cwd)
  }

  /** 通知 Host 这个目录马上要用来建会话；预热不授予目录权限，调用方需先校验。 */
  prepareWorkspace(cwd: string): void {
    this.resources.prepare(cwd)
  }

  /** 用户显式选定的目录：select-directory 成功后登记并落盘，是唯一的授权来源。 */
  async authorizeWorkspace(cwd: string): Promise<void> {
    const key = canonicalizePath(cwd)
    const authorized = await (this.authorizedLoad ??= loadAuthorizedWorkspaces(
      this.options.sessionDir,
    ).then((paths) => new Set(paths)))

    if (authorized.has(key)) return
    authorized.add(key)
    this.knownWorkspaces.add(key)

    await saveAuthorizedWorkspaces(this.options.sessionDir, authorized).catch(() => undefined)
  }

  /** 目录是否能搜文件、拉技能：用户选过的目录，或已有（活的/磁盘的）会话 cwd。 */
  async isKnownWorkspace(cwd: string): Promise<boolean> {
    const key = canonicalizePath(cwd)

    if (this.knownWorkspaces.has(key)) return true

    const authorized = await (this.authorizedLoad ??= loadAuthorizedWorkspaces(
      this.options.sessionDir,
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

  /** 某目录已加载的技能与 prompt 模板：只读已备好的 loader，不为未知目录新建 slot。 */
  async workspaceCommands(
    cwd: string,
  ): Promise<{ skills: ComposerCommand[]; prompts: ComposerCommand[] }> {
    if (this.options.createSession) return { skills: [], prompts: [] }
    const key = canonicalizePath(cwd)
    // 远程 skills 由扩展在会话启动后补进会话的 loader，有活会话就读它的
    const live = [...this.activeSessions.values()].find((session) => session.cwd === key)
    const slot = live ? { loader: live.loader } : await this.resources.peek(key)

    if (!slot) return { skills: [], prompts: [] }
    // 扩展命令名会被 Pi 在模板展开前截胡，作为保留名交给候选筛选
    const reserved = new Set<string>()

    for (const extension of slot.loader.getExtensions().extensions) {
      for (const name of extension.commands.keys()) reserved.add(name)
    }

    return {
      skills: slot.loader
        .getSkills()
        .skills.map((skill) => ({ name: skill.name, description: skill.description })),
      // 模板带 argumentHint：菜单用它提示该传什么参数
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
    const workspace = canonicalizePath(options.cwd ?? this.options.cwd ?? process.cwd())
    const binding = parseRemoteKey(workspace)
    const cwd = await this.resources.localCwd(workspace)
    const manager = SessionManager.create(cwd, this.options.sessionDir, { id: options.id })

    // 远程会话先把绑定写进会话，remote-workspace 扩展启动时读它
    if (binding) manager.appendCustomEntry(BINDING_ENTRY, binding)

    if (options.name) manager.appendSessionInfo(options.name)
    const path = manager.getSessionFile()
    const header = manager.getHeader()

    if (!path || !header) throw new Error("Pi did not create a persistent session")

    // 立即落盘 header，保证协议层分配的 id 持久化（Pi 仅在出现助手消息后写文件）。
    // SDK 无 ensurePersisted API，写入后用 SessionManager 回读校验替代。
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
      // AgentSession 创建失败（如无可用模型）时回滚，避免遗留空会话文件
      await this.rollbackSession(options.id, path)
      throw error
    }
  }

  /** 已打开的会话改 live 名；未打开的只追加 session_info。 */
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

  /** 删除 Pi 会话文件与它的任务日志；仍有活 runtime 时拒绝，否则它会把文件写回来。 */
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

  /** 停服：清掉附件清理定时器、关会话文件监听，并删除本实例的临时文件。 */
  dispose(): Promise<void> {
    this.providers.dispose()
    this.fileWatcher.close()
    return this.attachments.dispose()
  }

  /** 按需监听会话文件：同一会话共用一份 fs.watch，退订到零就关。 */
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

    // 与 createSession 同一套规范化拼写，SDK 的扩展缓存才不会被会话文件的原生拼写顶掉
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

  /** 历史 Transcript 的轻量形态：known 未变则不重发，after 对得上只给尾巴。 */
  sessionTranscript(...args: Parameters<TranscriptReader["page"]>) {
    return this.transcripts.page(...args)
  }

  /** 单条完整条目：轻量历史里被截断的工具输出展开时取。 */
  transcriptItem(sessionId: string, itemId: string): Promise<TranscriptItem | undefined> {
    return this.transcripts.item(sessionId, itemId)
  }

  /** 刷新 sessionId → 磁盘路径索引，返回本次扫描到的全部 session 信息。 */
  private async refreshSessionPaths(): Promise<IndexedSession[]> {
    const now = Date.now()

    if (this.sessionsCache && this.sessionsCache.expiresAt > now) return this.sessionsCache.infos

    const infos = await this.sessionIndex.list()
    this.sessionPaths.clear()

    for (const info of infos) this.sessionPaths.set(info.id, info.path)
    // ponytail: 短 TTL 代替无界扫盘；SDK 有 Session 变更通知后改精确失效。
    this.sessionsCache = { expiresAt: now + 2_000, infos }
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
