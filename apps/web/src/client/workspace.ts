/**
 * 本地 cwd Workspace preference（Browser platform）。
 * 已授权本地目录列表与最近使用的 cwd 持久化在 localStorage；
 * 目录授权属于 transport security，不进入任何 Agent Domain。
 * 平台层只处理 canonicalPath 字符串，展示视图由 features 层映射。
 */
import { readonly, ref } from "vue";

export const LOCAL_WORKSPACES_KEY = "pig.localWorkspaces";
export const LAST_CWD_KEY = "pig.lastCwd";

export type WorkspaceStorage = Pick<Storage, "getItem" | "setItem">;

/** 兼容旧偏好：统一分隔符、盘符大小写与尾斜杠。新路径由 Host realpath。 */
export function canonicalizeWorkspacePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[A-Z]:/.test(normalized)
    ? normalized[0]!.toLowerCase() + normalized.slice(1)
    : normalized;
}

/** 解析持久化的目录列表：非法 JSON 或非字符串项一律丢弃。 */
export function parseLocalWorkspaces(json: string | null): string[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .map(canonicalizeWorkspacePath);
  } catch {
    return [];
  }
}

export function loadLocalWorkspaces(storage: WorkspaceStorage = localStorage): string[] {
  try {
    return parseLocalWorkspaces(storage.getItem(LOCAL_WORKSPACES_KEY));
  } catch {
    return [];
  }
}

export function saveLocalWorkspaces(
  paths: readonly string[],
  storage: WorkspaceStorage = localStorage,
): void {
  try {
    storage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(paths));
  } catch {
    /* 隐私模式等场景下存储不可用，偏好仅存活于本页 */
  }
}

export function loadLastCwd(storage: WorkspaceStorage = localStorage): string | undefined {
  try {
    return storage.getItem(LAST_CWD_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveLastCwd(path: string, storage: WorkspaceStorage = localStorage): void {
  try {
    storage.setItem(LAST_CWD_KEY, path);
  } catch {
    /* 同上 */
  }
}

/** 本地目录列表偏好：添加/移除立即持久化；select 记录最近使用的 cwd。 */
export function useLocalWorkspaces() {
  const workspaces = ref<string[]>(loadLocalWorkspaces());
  const lastCwd = ref<string | undefined>(loadLastCwd());

  function add(path: string) {
    const canonicalPath = canonicalizeWorkspacePath(path);
    if (!canonicalPath || workspaces.value.includes(canonicalPath)) return;
    workspaces.value = [...workspaces.value, canonicalPath];
    saveLocalWorkspaces(workspaces.value);
  }
  function remove(path: string) {
    const canonicalPath = canonicalizeWorkspacePath(path);
    workspaces.value = workspaces.value.filter((item) => item !== canonicalPath);
    saveLocalWorkspaces(workspaces.value);
  }
  function selectCwd(path: string) {
    lastCwd.value = canonicalizeWorkspacePath(path);
    saveLastCwd(lastCwd.value);
  }
  return {
    workspaces: readonly(workspaces),
    lastCwd: readonly(lastCwd),
    add,
    remove,
    selectCwd,
  };
}
