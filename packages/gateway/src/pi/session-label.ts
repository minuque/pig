/** 列表展示名：用户命名优先，否则用首条消息截断。 */
export function sessionListName(info: {
  name?: string | undefined;
  firstMessage?: string | undefined;
}): string | undefined {
  const named = info.name?.trim();
  if (named) return named;
  const first = info.firstMessage?.replace(/\s+/g, " ").trim();
  if (!first) return undefined;
  return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}
