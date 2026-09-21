import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent"
import type { SessionEntry, SessionHeader, SessionInfo } from "@earendil-works/pi-coding-agent"
import type { ModelMetadata, SessionMetadata, TranscriptItem } from "@earendil-works/pi-protocol"
import {
  PiServerError,
  SessionNotFoundError,
  toProtocolModelMetadata,
} from "@earendil-works/pi-server"
import type {
  CreateSessionOptions,
  PiServerService,
  PiSessionRuntime,
} from "@earendil-works/pi-server"
import { canonicalizePath } from "../directory.js"
import type { ContextPreviewKey, ContextUsageEstimate } from "./context-usage.js"
import {
  conversationMessageCount,
  modelFromBranch,
  outcomeFromBranch,
  type SessionCard,
} from "./session-card.js"
import { sessionListName } from "./session-label.js"
import { PiHostSession } from "./session-runtime.js"
import { TranscriptProjection } from "./transcript.js"
import { pageTranscriptItems, pageTurnTimings } from "./transcript-page.js"
import { readTurnTimings, type TurnTiming } from "./turn-timing.js"

type Runtime = Awaited<ReturnType<typeof ModelRuntime.create>>

type SessionFactory = typeof createAgentSession

/** 已 reload 的资源加载器；同目录只交给一个会话持有。 */
type ResourceSlot = { loader: DefaultResourceLoader; inUse: boolean }

/** 借出的加载器与归还回调。 */
type Resource = { loader: DefaultResourceLoader; release: () => void }

const MAX_RESOURCE_SLOTS = 4

export interface PiHostServiceOptions {
  /** 统一会话目录；缺省用 Pi 默认（~/.pi/agent/sessions/<cwd>/）。 */
  sessionDir?: string
  /** 默认工作目录（createSession 未指定 cwd 时使用）。 */
  cwd?: string
  /** 测试注入：ModelRuntime 工厂。 */
  createRuntime?: () => Promise<Runtime>
  /** 测试注入：AgentSession 工厂。 */
  createSession?: SessionFactory
}

/**
 * 把 Pi SDK（SessionManager + AgentSession + ModelRuntime）映射为官方
 * PiServerService。会话真相以 Pi 持久化为准，本类不维护第二套领域状态。
 */
export class PiHostService implements PiServerService {
  /** sessionId → 会话文件路径（listSessions/openSession 时填充）。 */
  private readonly sessionPaths = new Map<string, string>()
  private readonly activeSessions = new Map<string, PiHostSession>()
  /** 规范化 cwd → 该目录已 reload 的 loader。 */
  private readonly resourceSlots = new Map<string, Promise<ResourceSlot>>()
  private runtimePromise?: Promise<Runtime>
  private sessionsCache: { expiresAt: number; infos: SessionInfo[] } | undefined

  constructor(private readonly options: PiHostServiceOptions = {}) {}

  async listSessions(): Promise<SessionMetadata[]> {
    const infos = await this.refreshSessionPaths()
    return infos.map((info) => {
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
   * 侧栏卡片投影：消息数来自 SessionInfo，模型来自当前分支最后一次 model_change。
   * 不进协议 SessionMetadata（strict，会丢掉额外字段）。
   */
  async listSessionCards(): Promise<SessionCard[]> {
    this.sessionsCache = undefined
    const infos = await this.refreshSessionPaths()
    return cardsFromInfos(infos)
  }

  async listModels(): Promise<ModelMetadata[]> {
    const runtime = await this.runtime()
    const models = await runtime.getAvailable()
    return models.map((model) =>
      toProtocolModelMetadata(model, runtime.hasConfiguredAuth(model.provider)),
    )
  }

  /** 监听前预热会话列表、模型目录和最近用过的会话目录，避免首次握手与首次建会话超时。 */
  async warm(): Promise<void> {
    const [sessions] = await Promise.all([this.listSessions(), this.listModels()])
    const cwd = recentSessionCwd(sessions)

    if (cwd) this.prepareWorkspace(cwd)
  }

  /** 通知 Host 这个目录马上要用来建会话；预热与会话共用同一份 loader 缓存。 */
  prepareWorkspace(cwd: string): void {
    if (this.options.createSession) return
    void this.slot(canonicalizePath(cwd)).catch(() => undefined)
  }

  async createSession(options: CreateSessionOptions): Promise<PiSessionRuntime> {
    const runtime = await this.runtime()
    const cwd = canonicalizePath(options.cwd ?? this.options.cwd ?? process.cwd())
    const manager = SessionManager.create(cwd, this.options.sessionDir, { id: options.id })

    if (options.name) manager.appendSessionInfo(options.name)
    const path = manager.getSessionFile()
    const header = manager.getHeader()

    if (!path || !header) throw new Error("Pi did not create a persistent session")

    // 立即落盘 header，保证 PiServer 分配的 id 持久化（Pi 仅在出现助手消息后写文件）。
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
      throw new PiServerError(
        "invalid_request",
        `Model ${options.model.provider}/${options.model.id} is unavailable`,
      )
    }

    let resource: Resource | undefined

    try {
      resource = await this.resources(cwd)

      const { session } = await this.sessionFactory()({
        cwd,
        modelRuntime: runtime,
        sessionManager: SessionManager.open(path),
        ...(resource ? { resourceLoader: resource.loader } : {}),
        ...(model ? { model } : {}),
        ...(options.thinkingLevel ? { thinkingLevel: options.thinkingLevel } : {}),
      })
      return this.trackSession(session, resource?.release)
    } catch (error) {
      resource?.release()
      // AgentSession 创建失败（如无可用模型）时回滚，避免遗留空会话文件
      await this.rollbackSession(options.id, path)
      throw error
    }
  }

  /** 已打开的会话改 live 名；未打开的只追加 session_info。 */
  async renameSession(sessionId: string, name: string): Promise<void> {
    const trimmed = name.trim()

    if (!trimmed) throw new PiServerError("invalid_request", "会话名不能为空")

    const live = this.activeSessions.get(sessionId)

    if (live) {
      live.setSessionName(trimmed)
      this.sessionsCache = undefined
      return
    }

    const path = await this.findSessionPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)
    SessionManager.open(path).appendSessionInfo(trimmed)
    this.sessionsCache = undefined
  }

  /** 删除 Pi 会话文件。 */
  async deleteSession(sessionId: string): Promise<void> {
    const path = await this.findSessionPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)
    await rm(path, { force: true })
    this.sessionPaths.delete(sessionId)
    this.sessionsCache = undefined
  }

  async openSession(sessionId: string): Promise<PiSessionRuntime> {
    const runtime = await this.runtime()
    const path = await this.findSessionPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)

    const manager = SessionManager.open(path)
    // 与 createSession 同一套规范化拼写，SDK 的扩展缓存才不会被会话文件的原生拼写顶掉
    const cwd = canonicalizePath(manager.getCwd())
    const resource = await this.resources(cwd)

    try {
      const { session } = await this.sessionFactory()({
        cwd,
        modelRuntime: runtime,
        sessionManager: manager,
        ...(resource ? { resourceLoader: resource.loader } : {}),
      })
      return this.trackSession(session, resource?.release)
    } catch (error) {
      resource?.release()
      throw error
    }
  }

  contextUsage(
    sessionId: string,
    previewKey?: ContextPreviewKey,
  ): ContextUsageEstimate | undefined {
    return this.activeSessions.get(sessionId)?.contextUsage(previewKey)
  }

  /** 历史 Transcript：默认最后一轮；before 取更早页。不进协议 snapshot。 */
  async sessionTranscript(
    sessionId: string,
    query?: { before?: string },
  ): Promise<{ items: TranscriptItem[]; timings: TurnTiming[]; hasMore: boolean }> {
    const live = this.activeSessions.get(sessionId)
    const full = live ? live.historyTranscript() : await this.readDiskTranscript(sessionId)
    const page = pageTranscriptItems(full.items, query)
    return {
      items: page.items,
      timings: pageTurnTimings(full.timings, page.items),
      hasMore: page.hasMore,
    }
  }

  private async readDiskTranscript(sessionId: string) {
    const path = await this.findSessionPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)
    const entries = SessionManager.open(path).getBranch()
    return {
      items: new TranscriptProjection().transcript(entries),
      timings: readTurnTimings(entries),
    }
  }

  /** 刷新 sessionId → 磁盘路径索引，返回本次扫描到的全部 session 信息。 */
  private async refreshSessionPaths(): Promise<SessionInfo[]> {
    const now = Date.now()

    if (this.sessionsCache && this.sessionsCache.expiresAt > now) return this.sessionsCache.infos

    const infos = await SessionManager.listAll(this.options.sessionDir)
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
    return (this.runtimePromise ??= (this.options.createRuntime ?? createDefaultRuntime)())
  }

  /**
   * 取该目录已 reload 的 loader，交给会话复用，省掉 SDK 里的 reload 与扩展重新转译。
   * 同目录已有会话持有时改用新实例：扩展运行时的绑定写在这份 extensionsResult 上。
   */
  private async resources(cwd: string): Promise<Resource | undefined> {
    if (this.options.createSession) return undefined

    const key = canonicalizePath(cwd)
    const slot = await this.slot(key)

    if (slot.inUse) return { loader: await this.createLoader(key), release: () => undefined }
    slot.inUse = true
    return {
      loader: slot.loader,
      release: () => {
        slot.inUse = false
      },
    }
  }

  /** 每个目录一份 loader；并发请求共用同一次加载，超上限按插入顺序淘汰一项。 */
  private slot(cwd: string): Promise<ResourceSlot> {
    const cached = this.resourceSlots.get(cwd)

    if (cached) return cached

    if (this.resourceSlots.size >= MAX_RESOURCE_SLOTS) {
      const oldest = this.resourceSlots.keys().next()

      if (!oldest.done) this.resourceSlots.delete(oldest.value)
    }

    const pending = this.createLoader(cwd).then(
      (loader) => ({ loader, inUse: false }),
      (error: unknown) => {
        this.resourceSlots.delete(cwd)
        throw error
      },
    )

    this.resourceSlots.set(cwd, pending)
    return pending
  }

  /** 新建并 reload 一份 loader；同拼写下 SDK 复用扩展模块缓存，不重复转译。 */
  private async createLoader(cwd: string): Promise<DefaultResourceLoader> {
    const agentDir = getAgentDir()
    const settingsManager = SettingsManager.create(cwd, agentDir)
    const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager })
    await loader.reload()
    return loader
  }

  private sessionFactory(): SessionFactory {
    return this.options.createSession ?? createAgentSession
  }

  private trackSession(
    session: Awaited<ReturnType<SessionFactory>>["session"],
    release?: () => void,
  ): PiHostSession {
    let host!: PiHostSession
    host = new PiHostSession(session, () => {
      if (this.activeSessions.get(session.sessionId) === host) {
        this.activeSessions.delete(session.sessionId)
      }

      release?.()
    })
    this.activeSessions.set(session.sessionId, host)
    return host
  }

  private async rollbackSession(sessionId: string, path: string): Promise<void> {
    this.sessionsCache = undefined
    this.sessionPaths.delete(sessionId)
    await rm(path, { force: true })
  }
}

function cardsFromInfos(infos: readonly SessionInfo[]): SessionCard[] {
  return infos.map((info) => {
    let model: SessionCard["model"]
    let outcome: SessionCard["outcome"]
    let messageCount = info.messageCount

    try {
      const branch = SessionManager.open(info.path).getBranch()
      model = modelFromBranch(branch)
      outcome = outcomeFromBranch(branch)
      messageCount = conversationMessageCount(branch)
    } catch {
      model = undefined
    }

    return {
      id: info.id,
      messageCount,
      ...(model ? { model } : {}),
      ...(outcome ? { outcome } : {}),
    }
  })
}

/** 最近使用过的会话目录；网关启动时按它预热，与会话文件里存的是同一个目录。 */
export function recentSessionCwd(sessions: readonly SessionMetadata[]): string | undefined {
  let latest: SessionMetadata | undefined

  for (const session of sessions) {
    if (!session.cwd) continue

    if (!latest || usedAt(session) > usedAt(latest)) latest = session
  }

  return latest?.cwd
}

function usedAt(session: SessionMetadata): number {
  return session.updatedAt ?? session.createdAt
}

/** 测试注入用默认 ModelRuntime：不做网络刷新，避免启动时拉取模型目录。 */
function createDefaultRuntime(): Promise<Runtime> {
  return ModelRuntime.create({ allowModelNetwork: false })
}

/** 与仓库既有做法一致：header + 条目逐行 JSON 落盘。 */
function serializeEntries(header: SessionHeader, entries: SessionEntry[]): string {
  return [header, ...entries].map((entry) => JSON.stringify(entry)).join("\n") + "\n"
}
