import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionEntry, SessionHeader } from "@earendil-works/pi-coding-agent";
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

  constructor(private readonly options: PiHostServiceOptions = {}) {}

  async listSessions(): Promise<SessionMetadata[]> {
    const infos = await SessionManager.listAll(this.options.sessionDir);
    this.sessionPaths.clear();
    return infos.map((info) => {
      this.sessionPaths.set(info.id, info.path);
      return {
        id: info.id,
        createdAt: info.created.getTime(),
        ...(info.modified ? { updatedAt: info.modified.getTime() } : {}),
        ...(info.name ? { sessionName: info.name } : {}),
        ...(info.cwd ? { cwd: info.cwd } : {}),
      };
    });
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
    const cwd = options.cwd ?? this.options.cwd ?? process.cwd();
    const manager = SessionManager.create(cwd, this.options.sessionDir, { id: options.id });
    if (options.name) manager.appendSessionInfo(options.name);
    const path = manager.getSessionFile();
    const header = manager.getHeader();
    if (!path || !header) throw new Error("Pi did not create a persistent session");
    // 立即落盘 header，保证 PiServer 分配的 id 持久化（Pi 仅在出现助手消息后写文件）
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, serializeEntries(header, manager.getEntries()), { flag: "wx" });
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

  private async findSessionPath(sessionId: string): Promise<string | undefined> {
    const cached = this.sessionPaths.get(sessionId);
    if (cached) return cached;
    const infos = await SessionManager.listAll(this.options.sessionDir);
    this.sessionPaths.clear();
    for (const info of infos) this.sessionPaths.set(info.id, info.path);
    return this.sessionPaths.get(sessionId);
  }

  private runtime(): Promise<Runtime> {
    return (this.runtimePromise ??= (this.options.createRuntime ?? createDefaultRuntime)());
  }

  private sessionFactory(): SessionFactory {
    return this.options.createSession ?? createAgentSession;
  }

  private async rollbackSession(sessionId: string, path: string): Promise<void> {
    this.sessionPaths.delete(sessionId);
    await rm(path, { force: true });
  }
}

/** 测试注入用默认 ModelRuntime：不做网络刷新，避免启动时拉取模型目录。 */
function createDefaultRuntime(): Promise<Runtime> {
  return ModelRuntime.create({ allowModelNetwork: false });
}

/** 与仓库既有做法一致：header + 条目逐行 JSON 落盘。 */
function serializeEntries(header: SessionHeader, entries: SessionEntry[]): string {
  return [header, ...entries].map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}
