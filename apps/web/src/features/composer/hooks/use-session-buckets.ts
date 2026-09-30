import { ref } from "vue"

export interface SessionBuckets<T> {
  /** 当前会话的桶，不存在时创建。 */
  current(): T
  /** 指定会话的桶（后台泵队等跨会话操作用），不存在时创建。 */
  forKey(sessionId: string | undefined): T
  setKey(sessionId: string | undefined): void
  clearAll(): void
}

/**
 * 按 sessionId 分桶的内存暂存（welcome 用 ""）。切走再回来还在。
 * 普通 Map 存显式 ref：嵌套在 reactive Map 里的数组不保证触发 computed。
 */
export function useSessionBuckets<T>(
  create: () => T,
  release?: (value: T) => void,
): SessionBuckets<T> {
  const buckets = new Map<string, T>()
  const key = ref("")

  function forKey(sessionId: string | undefined): T {
    const name = sessionId ?? ""
    let value = buckets.get(name)

    if (value === undefined) buckets.set(name, (value = create()))
    return value
  }

  function current(): T {
    return forKey(key.value)
  }

  function setKey(sessionId: string | undefined) {
    key.value = sessionId ?? ""
  }

  function clearAll() {
    if (release) buckets.forEach((value) => release(value))
    buckets.clear()
  }

  return { current, forKey, setKey, clearAll }
}
