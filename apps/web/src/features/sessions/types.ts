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

/** 已授权目录优先；其余 Pi Session 按 cwd 继续展示。 */
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
      sessions: byPath.get(canonicalPath) ?? [],
      authorized: true,
    })),
    ...[...byPath]
      .filter(([canonicalPath]) => !local.has(canonicalPath))
      .map(([canonicalPath, groupedSessions]) => ({
        canonicalPath,
        sessions: groupedSessions,
        authorized: false,
      })),
  ];
}

/** 将本地目录路径列表映射为 LocalWorkspace 视图。 */
export function localWorkspacesFrom(paths: readonly string[]): LocalWorkspace[] {
  return paths.map((canonicalPath) => ({ canonicalPath }));
}
