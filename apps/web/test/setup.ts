/**
 * node 环境没有 localStorage，而偏好读写的默认参数直接引用它。
 * 测试启动前补一个内存实现，避免调用链一碰偏好就抛 ReferenceError。
 */

const store = new Map<string, string>()
const memoryStorage: Storage = {
  get length() {
    return store.size
  },
  key: (index) => [...store.keys()][index] ?? null,
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => {
    store.set(key, String(value))
  },
  removeItem: (key) => {
    store.delete(key)
  },
  clear: () => {
    store.clear()
  },
}

if (!("localStorage" in globalThis)) {
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true })
}
