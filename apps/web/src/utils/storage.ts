export type PrefStorage = Pick<Storage, "getItem" | "setItem">

export function readPref(key: string, storage: PrefStorage = localStorage): string | undefined {
  try {
    return storage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

export function writePref(key: string, value: string, storage: PrefStorage = localStorage): void {
  try {
    storage.setItem(key, value)
  } catch {}
}

export function readEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  storage: PrefStorage = localStorage,
): T {
  const value = readPref(key, storage)
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function readFlag(key: string, storage: PrefStorage = localStorage): boolean {
  return readPref(key, storage) !== "off"
}

export function writeFlag(key: string, on: boolean, storage: PrefStorage = localStorage): void {
  writePref(key, on ? "on" : "off", storage)
}

export function readStringArray(key: string, storage: PrefStorage = localStorage): string[] {
  const raw = readPref(key, storage)

  if (raw === undefined) return []

  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

export function readJson<T>(key: string, storage: PrefStorage = localStorage): T | undefined {
  const raw = readPref(key, storage)

  if (raw === undefined) return undefined

  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === "object" && value !== null ? (value as T) : undefined
  } catch {
    return undefined
  }
}

export function writeJson(key: string, value: unknown, storage: PrefStorage = localStorage): void {
  writePref(key, JSON.stringify(value), storage)
}

export function readNumber(key: string, storage: PrefStorage = localStorage): number | undefined {
  const raw = readPref(key, storage)

  if (raw === undefined || raw.trim() === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function writeNumber(key: string, value: number, storage: PrefStorage = localStorage): void {
  writePref(key, String(value), storage)
}
