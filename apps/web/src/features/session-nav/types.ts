import type { SessionMetadata } from "@earendil-works/pi-protocol";

/** 本地已授权目录（cwd），canonicalPath 为唯一标识。 */
export interface LocalWorkspace {
  canonicalPath: string;
}

/** 左侧导航按 cwd 分组；authorized 表示目录在本地授权列表。 */
export interface SessionGroup {
  canonicalPath: string;
  sessions: SessionMetadata[];
  authorized: boolean;
}

/** 取路径最后一段作为展示名；路径为空或仅分隔符时原样返回。 */
export function workspaceName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

/** 未命名 Session 的列表/标题回退文案。 */
export const UNTITLED_SESSION = "新会话";

/** 列表标题：Pi sessionName，否则「新会话」。 */
export function sessionTitle(session: Pick<SessionMetadata, "sessionName">): string {
  const name = session.sessionName?.trim();
  return name || UNTITLED_SESSION;
}

/** 最近活动时刻：优先 updatedAt。 */
export function sessionRecency(session: Pick<SessionMetadata, "createdAt" | "updatedAt">): number {
  return session.updatedAt ?? session.createdAt;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 侧栏相对时间：T3 compact（刚刚 / 48m / 2h / 1d）。 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  const delta = Math.max(0, now - timestamp);
  if (delta < MINUTE) return "刚刚";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  return `${Math.floor(delta / DAY)}d`;
}

function sortSessionsByRecency(sessions: SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort((a, b) => sessionRecency(b) - sessionRecency(a));
}

/**
 * 侧栏会话序：按创建时间新→旧，活动不重排。
 * 对齐 T3 `sortThreadsForSidebar`（createdAt 静态序）。
 */
export function sortSessionsForSidebar(sessions: readonly SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort(
    (left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id),
  );
}

/**
 * 会话维列表：无 cwd 的 Session 不进侧栏；scopeCwd 为 null 即全部工作目录。
 */
export function listSessionsForSidebar(
  sessions: readonly SessionMetadata[],
  scopeCwd: string | null,
): SessionMetadata[] {
  return sortSessionsForSidebar(
    sessions.filter((session) => session.cwd && (scopeCwd === null || session.cwd === scopeCwd)),
  );
}

/** 已授权目录优先；其余 Pi Session 按 cwd 继续展示。组内按最近活动倒序。 */
export function groupSessionsByCwd(
  sessions: readonly SessionMetadata[],
  localWorkspaces: readonly string[],
): SessionGroup[] {
  const byPath = new Map<string, SessionMetadata[]>();
  for (const session of sessions) {
    if (!session.cwd) continue;
    const list = byPath.get(session.cwd);
    if (list) list.push(session);
    else byPath.set(session.cwd, [session]);
  }
  const local = new Set(localWorkspaces);
  return [
    ...localWorkspaces.map((canonicalPath) => ({
      canonicalPath,
      sessions: sortSessionsByRecency(byPath.get(canonicalPath) ?? []),
      authorized: true,
    })),
    ...[...byPath]
      .filter(([canonicalPath]) => !local.has(canonicalPath))
      .map(([canonicalPath, groupedSessions]) => ({
        canonicalPath,
        sessions: sortSessionsByRecency(groupedSessions),
        authorized: false,
      })),
  ];
}

/** 将本地目录路径列表映射为 LocalWorkspace 视图。 */
export function localWorkspacesFrom(paths: readonly string[]): LocalWorkspace[] {
  return paths.map((canonicalPath) => ({ canonicalPath }));
}

/** 协议列表不带的卡片脚注：消息数 + 当前模型。 */
export interface SessionCardExtra {
  messageCount: number;
  model?: { provider: string; id: string };
}

export interface SessionCardLive {
  sessionId: string;
  messageCount: number;
  model: { provider: string; id: string };
}

export function modelDisplayNames(
  catalog: readonly { id: string; models: readonly { id: string; name: string }[] }[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const vendor of catalog) {
    for (const model of vendor.models) names.set(`${vendor.id}/${model.id}`, model.name);
  }
  return names;
}

export function sessionModelLabel(
  model: { provider: string; id: string } | undefined,
  names: ReadonlyMap<string, string>,
): string {
  if (!model) return "";
  return names.get(`${model.provider}/${model.id}`) ?? model.id;
}

export function sessionCardFoot(
  sessionId: string,
  extras: ReadonlyMap<string, SessionCardExtra>,
  live: SessionCardLive | undefined,
  names: ReadonlyMap<string, string>,
): { messageCount: number | undefined; modelLabel: string } {
  const extra = extras.get(sessionId);
  const isLive = live?.sessionId === sessionId;
  return {
    messageCount: isLive ? live.messageCount : extra?.messageCount,
    modelLabel: sessionModelLabel(isLive ? live.model : extra?.model, names),
  };
}
