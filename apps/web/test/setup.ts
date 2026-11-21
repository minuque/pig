import { vi } from "vitest"

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

const originalWaitFor = vi.waitFor.bind(vi)

vi.waitFor = ((callback: Parameters<typeof originalWaitFor>[0], options?: object | number) =>
  originalWaitFor(
    callback,
    typeof options === "number" ? { interval: 1, timeout: options } : { interval: 1, ...options },
  )) as typeof vi.waitFor
