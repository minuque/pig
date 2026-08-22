import type { SessionMetadata } from "@earendil-works/pi-protocol";

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
