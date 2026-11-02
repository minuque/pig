/** 开发模式首帧导航可能撞上 Vite 重启；只对这些瞬时网络错误重试。 */
const TRANSIENT_LOAD_ERROR =
  /ERR_(?:FAILED|CONNECTION_REFUSED|CONNECTION_RESET|CONNECTION_CLOSED|EMPTY_RESPONSE)\b/

export function isTransientLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return TRANSIENT_LOAD_ERROR.test(message)
}

type LoadRetryOptions = { attempts?: number; delayMs?: number }

/** 导航重试：非瞬时错误立刻抛出，瞬时错误按次数退避。 */
export async function loadWithRetry(
  load: () => Promise<void>,
  options: LoadRetryOptions = {},
): Promise<void> {
  const attempts = options.attempts ?? 3
  const delayMs = options.delayMs ?? 300

  for (let attempt = 1; ; attempt += 1) {
    try {
      await load()
      return
    } catch (error) {
      if (attempt >= attempts || !isTransientLoadError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }
}
