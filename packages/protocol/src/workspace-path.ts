export function canonicalizeWorkspacePath(
  path: string,
  options?: { caseInsensitive?: boolean },
): string {
  const trimmed = path.replaceAll("\\", "/").replace(/\/+$/, "")
  // 外部：`c:` 是该盘当前目录，不是盘符根，根路径要保留尾斜杠
  const normalized =
    (trimmed === "" && path !== "") || /^[a-zA-Z]:$/.test(trimmed) ? `${trimmed}/` : trimmed

  if (options?.caseInsensitive || /^[a-zA-Z]:/.test(normalized)) return normalized.toLowerCase()
  return normalized
}
