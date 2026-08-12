import type { SessionMetadata } from "@earendil-works/pi-protocol";

/** 本地已授权目录（cwd），canonicalPath 为唯一标识。 */
export interface LocalWorkspace {
  canonicalPath: string;
}

/** 左侧导航按本地目录分组的 Session 列表。 */
export interface SessionGroup {
  canonicalPath: string;
  sessions: SessionMetadata[];
}

/** 取路径最后一段作为展示名；路径为空或仅分隔符时原样返回。 */
export function workspaceName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

/** 将服务端 Session 元数据按 cwd 分组；本地目录即使无 Session 也保留组（供空态提示）。 */
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
  const groups: SessionGroup[] = [];
  for (const canonicalPath of localWorkspaces) {
    groups.push({ canonicalPath, sessions: byPath.get(canonicalPath) ?? [] });
  }
  return groups;
}

/** 将本地目录路径列表映射为 LocalWorkspace 视图。 */
export function localWorkspacesFrom(paths: readonly string[]): LocalWorkspace[] {
  return paths.map((canonicalPath) => ({ canonicalPath }));
}
