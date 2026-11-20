/** 两端共用的运行时常量：路径、上限与会话条目名。只放值，不放平台相关实现。 */

/** WebSocket 握手路径：gateway 挂载，web 连接。 */
export const WEBSOCKET_PATH = "/api/v1/pi"
/** 单个 batch 的附件数上限。 */
export const MAX_BATCH_ITEMS = 8
/** 图片单文件上限 3MB：provider 内联上限约 4.5MB base64，3MB 编码后约 4MB。 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
/** 非图片单文件上限 25MB。 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024
/** provider 只稳定接受这几种内联图片，其余走文件落盘，否则整轮会被拒。 */
export const INLINE_IMAGE_PATTERN = /^image\/(png|jpeg|gif|webp)$/i
/** 回合计时写入会话条目的 customType，扩展写、网关读。 */
export const TURN_TIMING_ENTRY = "pig.turn-timing"
/** 子会话标记，会话索引据此把子会话与普通分叉区分开。 */
export const SUBAGENT_ENTRY = "pig.subagent"

/**
 * 工作区键的规范化：统一分隔符、去尾斜杠，根路径保留尾斜杠，远程键的主机段单独补斜杠。
 * 大小写不在这里处理：Windows 的整段小写由 gateway 决定，web 只折叠盘符。
 */
export function canonicalizeWorkspaceKey(path: string): string {
  if (path.startsWith("ssh://")) {
    const key = path.replace(/\/+$/, "")
    return /^ssh:\/\/[^/]+$/.test(key) ? `${key}/` : key
  }

  const trimmed = path.replaceAll("\\", "/").replace(/\/+$/, "")
  const root = (trimmed === "" && path !== "") || /^[a-zA-Z]:$/.test(trimmed)
  return root ? `${trimmed}/` : trimmed
}

/** 浏览器侧的本地路径键：键规范化后再把盘符路径整段小写。 */
export function canonicalizeWorkspacePath(path: string): string {
  const key = canonicalizeWorkspaceKey(path)
  return /^[a-zA-Z]:/.test(key) ? key.toLowerCase() : key
}
