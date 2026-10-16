import { ref } from "vue"

/**
 * 按 sessionId 分桶的内存暂存（welcome 用 ""）。切走再回来还在。
 * 普通 Map 存显式 ref：嵌套在 reactive Map 里的数组不保证触发 computed。
 */
export function useSessionBuckets<T>(create: () => T, release?: (value: T) => void) {
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
