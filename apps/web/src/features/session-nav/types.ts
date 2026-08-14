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

/** 侧栏相对时间：48分钟 / 2小时 / 昨天 / 3天 / 8月14日。 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  const delta = Math.max(0, now - timestamp);
  if (delta < MINUTE) return "刚刚";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}分钟`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}小时`;
  if (delta < 2 * DAY) return "昨天";
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}天`;
  const date = new Date(timestamp);
  const current = new Date(now);
  if (date.getFullYear() === current.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function sortSessionsByRecency(sessions: SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort((a, b) => sessionRecency(b) - sessionRecency(a));
}

/** 默认不展开；仅当 lastCwd 仍在列表里时展开它。 */
export function initialExpandedWorkspace(
  groups: readonly Pick<SessionGroup, "canonicalPath">[],
  lastCwd: string | undefined,
): string | undefined {
  if (lastCwd && groups.some((group) => group.canonicalPath === lastCwd)) return lastCwd;
  return undefined;
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
