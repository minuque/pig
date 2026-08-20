import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionEntry, SessionHeader, SessionInfo } from "@earendil-works/pi-coding-agent";
import type { ModelMetadata, SessionMetadata } from "@earendil-works/pi-protocol";
import {
  PiServerError,
  SessionNotFoundError,
  toProtocolModelMetadata,
} from "@earendil-works/pi-server";
import type {
  CreateSessionOptions,
  PiServerService,
  PiSessionRuntime,
} from "@earendil-works/pi-server";
import { canonicalizePath } from "../directory.js";
import { modelFromBranch, type SessionCard } from "./session-card.js";
import { sessionListName } from "./session-label.js";
import { PiHostSession } from "./session-runtime.js";

type Runtime = Awaited<ReturnType<typeof ModelRuntime.create>>;
type SessionFactory = typeof createAgentSession;

export interface PiHostServiceOptions {
  /** 统一会话目录；缺省用 Pi 默认（~/.pi/agent/sessions/<cwd>/）。 */
  sessionDir?: string;
  /** 默认工作目录（createSession 未指定 cwd 时使用）。 */
  cwd?: string;
  /** 测试注入：ModelRuntime 工厂。 */
  createRuntime?: () => Promise<Runtime>;
  /** 测试注入：AgentSession 工厂。 */
  createSession?: SessionFactory;
}

/**
 * 把 Pi SDK（SessionManager + AgentSession + ModelRuntime）映射为官方
 * PiServerService。会话真相以 Pi 持久化为准，本类不维护第二套领域状态。
 */
export class PiHostService implements PiServerService {
  /** sessionId → 会话文件路径（listSessions/openSession 时填充）。 */
  private readonly sessionPaths = new Map<string, string>();
  private runtimePromise?: Promise<Runtime>;
  private sessionsCache:
    { expiresAt: number; infos: SessionInfo[]; cards: SessionCard[] } | undefined;

  constructor(private readonly options: PiHostServiceOptions = {}) {}

  async listSessions(): Promise<SessionMetadata[]> {
    const infos = await this.refreshSessionPaths();
    return infos.map((info) => {
      const sessionName = sessionListName(info);
      return {
        id: info.id,
        createdAt: info.created.getTime(),
        ...(info.modified ? { updatedAt: info.modified.getTime() } : {}),
        ...(sessionName ? { sessionName } : {}),
        ...(info.cwd ? { cwd: canonicalizePath(info.cwd) } : {}),
      };
    });
  }

  /**
   * 侧栏卡片投影：消息数来自 SessionInfo，模型来自当前分支最后一次 model_change。
   * 不进协议 SessionMetadata（strict，会丢掉额外字段）。
   */
  async listSessionCards(): Promise<SessionCard[]> {
    await this.refreshSessionPaths();
    return this.sessionsCache?.cards ?? [];
  }

  async listModels(): Promise<ModelMetadata[]> {
    const runtime = await this.runtime();
    const models = await runtime.getAvailable();
    return models.map((model) =>
      toProtocolModelMetadata(model, runtime.hasConfiguredAuth(model.provider)),
    );
  }

  async createSession(options: CreateSessionOptions): Promise<PiSessionRuntime> {
    const runtime = await this.runtime();
    const cwd = canonicalizePath(options.cwd ?? this.options.cwd ?? process.cwd());
    const manager = SessionManager.create(cwd, this.options.sessionDir, { id: options.id });
    if (options.name) manager.appendSessionInfo(options.name);
    const path = manager.getSessionFile();
    const header = manager.getHeader();
    if (!path || !header) throw new Error("Pi did not create a persistent session");
    // 立即落盘 header，保证 PiServer 分配的 id 持久化（Pi 仅在出现助手消息后写文件）
    await mkdir(dirname(path), { recursive: true });
    // temporary compatibility: SDK 暂无 ensurePersisted；写后立即用 SessionManager 回读校验。
    await writeFile(path, serializeEntries(header, manager.getEntries()), { flag: "wx" });
    if (SessionManager.open(path).getHeader()?.id !== options.id) {
      await rm(path, { force: true });
      throw new Error("Pi session persistence format validation failed");
    }
    this.sessionsCache = undefined;
    this.sessionPaths.set(options.id, path);
    const model = options.model
      ? runtime.getModel(options.model.provider, options.model.id)
      : undefined;
    if (options.model && !model) {
      await this.rollbackSession(options.id, path);
      throw new PiServerError(
        "invalid_request",
        `Model ${options.model.provider}/${options.model.id} is unavailable`,
      );
    }
    try {
      const { session } = await this.sessionFactory()({
        cwd,
        modelRuntime: runtime,
        sessionManager: SessionManager.open(path),
        ...(model ? { model } : {}),
        ...(options.thinkingLevel ? { thinkingLevel: options.thinkingLevel } : {}),
      });
      return new PiHostSession(session);
    } catch (error) {
      // AgentSession 创建失败（如无可用模型）时回滚，避免遗留空会话文件
      await this.rollbackSession(options.id, path);
      throw error;
    }
  }

  /** 通过 Pi SessionManager 追加 session_info，不另建一套命名状态。 */
  async renameSession(sessionId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new PiServerError("invalid_request", "会话名不能为空");
    const path = await this.findSessionPath(sessionId);
    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`);
    SessionManager.open(path).appendSessionInfo(trimmed);
    this.sessionsCache = undefined;
  }

  /** 删除 Pi 会话文件。 */
  async deleteSession(sessionId: string): Promise<void> {
    const path = await this.findSessionPath(sessionId);
    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`);
    await rm(path, { force: true });
    this.sessionPaths.delete(sessionId);
    this.sessionsCache = undefined;
  }

  async openSession(sessionId: string): Promise<PiSessionRuntime> {
    const runtime = await this.runtime();
    const path = await this.findSessionPath(sessionId);
    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`);
    const { session } = await this.sessionFactory()({
      cwd: SessionManager.open(path).getCwd(),
      modelRuntime: runtime,
      sessionManager: SessionManager.open(path),
    });
    return new PiHostSession(session);
  }

  /** 刷新 sessionId → 磁盘路径索引，返回本次扫描到的全部 session 信息。 */
  private async refreshSessionPaths(): Promise<SessionInfo[]> {
    const now = Date.now();
    if (this.sessionsCache && this.sessionsCache.expiresAt > now) return this.sessionsCache.infos;
    const infos = await SessionManager.listAll(this.options.sessionDir);
    this.sessionPaths.clear();
    for (const info of infos) this.sessionPaths.set(info.id, info.path);
    // ponytail: 短 TTL 代替无界扫盘；SDK 有 Session 变更通知后改精确失效。
    this.sessionsCache = { expiresAt: now + 2_000, infos, cards: cardsFromInfos(infos) };
    return infos;
  }

  private async findSessionPath(sessionId: string): Promise<string | undefined> {
    const cached = this.sessionPaths.get(sessionId);
    if (cached) return cached;
    await this.refreshSessionPaths();
    return this.sessionPaths.get(sessionId);
  }

  private runtime(): Promise<Runtime> {
    return (this.runtimePromise ??= (this.options.createRuntime ?? createDefaultRuntime)());
  }

  private sessionFactory(): SessionFactory {
    return this.options.createSession ?? createAgentSession;
  }

  private async rollbackSession(sessionId: string, path: string): Promise<void> {
    this.sessionsCache = undefined;
    this.sessionPaths.delete(sessionId);
    await rm(path, { force: true });
  }
}

function cardsFromInfos(infos: readonly SessionInfo[]): SessionCard[] {
  return infos.map((info) => {
    let model: SessionCard["model"];
    try {
      model = modelFromBranch(SessionManager.open(info.path).getBranch());
    } catch {
      model = undefined;
    }
    return {
      id: info.id,
      messageCount: info.messageCount,
      ...(model ? { model } : {}),
    };
  });
}

/** 测试注入用默认 ModelRuntime：不做网络刷新，避免启动时拉取模型目录。 */
function createDefaultRuntime(): Promise<Runtime> {
  return ModelRuntime.create({ allowModelNetwork: false });
}

/** 与仓库既有做法一致：header + 条目逐行 JSON 落盘。 */
function serializeEntries(header: SessionHeader, entries: SessionEntry[]): string {
  return [header, ...entries].map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}
