import { ref } from "vue"

export interface SessionBuckets<T> {
  /** 当前会话的桶，不存在时创建。 */
  current(): T
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

  function current(): T {
    let value = buckets.get(key.value)

    if (value === undefined) buckets.set(key.value, (value = create()))
    return value
  }

  function setKey(sessionId: string | undefined) {
    key.value = sessionId ?? ""
  }

  function clearAll() {
    if (release) buckets.forEach((value) => release(value))
    buckets.clear()
  }

  return { current, setKey, clearAll }
}
