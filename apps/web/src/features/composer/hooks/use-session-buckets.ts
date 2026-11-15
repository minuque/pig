import { getCurrentInstance, inject, provide, ref, type InjectionKey } from "vue"

type BucketName = "queue" | "attachments"

export type SharedBuckets = Map<BucketName, Map<string, unknown>>

const sharedKey: InjectionKey<SharedBuckets> = Symbol("session-buckets")
let idleSeq = 0

export function createSharedBuckets(): SharedBuckets {
  return new Map()
}

/** 两侧 workbench 共用同一份按会话分桶的暂存：会话换到另一侧时队列和附件跟着走。 */
export function provideSharedBuckets() {
  provide(sharedKey, createSharedBuckets())
}

/**
 * 按 sessionId 分桶的内存暂存（welcome 用这一侧的空闲键）。切走再回来还在。
 * 普通 Map 存显式 ref：嵌套在 reactive Map 里的数组不保证触发 computed。
 */
export function useSessionBuckets<T>(
  create: () => T,
  release?: (value: T) => void,
  name?: BucketName,
  store?: SharedBuckets,
) {
  const stores = name
    ? (store ?? (getCurrentInstance() ? inject(sharedKey, undefined) : undefined))
    : undefined
  let shared = stores?.get(name!) as Map<string, T> | undefined

  if (stores && !shared) stores.set(name!, (shared = new Map()))
  const buckets = shared ?? new Map<string, T>()
  // 共用时新会话页的桶按这一侧单独起名，两侧的新会话页互不串
  const idle = shared ? `welcome-${++idleSeq}` : ""
  const key = ref(idle)

  function forKey(sessionId: string | undefined): T {
    const name = sessionId ?? idle
    let value = buckets.get(name)

    if (value === undefined) buckets.set(name, (value = create()))
    return value
  }

  function current(): T {
    return forKey(key.value)
  }

  function setKey(sessionId: string | undefined) {
    key.value = sessionId ?? idle
  }

  /** 欢迎页建出会话：整桶改挂到新会话名下，目标已有内容就不动。 */
  function handOff(sessionId: string) {
    const value = buckets.get(idle)

    if (value === undefined || buckets.has(sessionId)) return
    buckets.set(sessionId, value)
    buckets.delete(idle)
  }

  function clearAll() {
    if (release) buckets.forEach((value) => release(value))
    buckets.clear()
  }

  return { current, forKey, setKey, handOff, clearAll, shared: shared !== undefined }
}
