import { getCurrentInstance, inject, provide, ref, type InjectionKey } from "vue"

type BucketName = "queue" | "attachments" | "draft"

export type SharedBuckets = Map<BucketName, Map<string, unknown>>

const sharedKey: InjectionKey<SharedBuckets> = Symbol("session-buckets")
let idleSeq = 0

export function createSharedBuckets(): SharedBuckets {
  return new Map()
}

export function provideSharedBuckets(): SharedBuckets {
  const store = createSharedBuckets()
  provide(sharedKey, store)
  return store
}

// 外部：嵌套在 reactive Map 里的数组不保证触发 computed，桶里存显式 ref
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
