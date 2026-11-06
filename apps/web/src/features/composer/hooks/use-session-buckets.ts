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

  /** 欢迎页建出会话：整桶改挂到新会话名下，目标已有内容就不动。 */
  function handOff(sessionId: string) {
    const value = buckets.get("")

    if (value === undefined || buckets.has(sessionId)) return
    buckets.set(sessionId, value)
    buckets.delete("")
  }

  function clearAll() {
    if (release) buckets.forEach((value) => release(value))
    buckets.clear()
  }

  return { current, forKey, setKey, handOff, clearAll }
}
