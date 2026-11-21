import { readPref, writePref, type PrefStorage } from "@utils/storage.js"

const MAX_SESSIONS = 100

function readAll(key: string, storage: PrefStorage): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readPref(key, storage) ?? "{}")
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function readSessionValue<T>(
  key: string,
  sessionId: string,
  valid: (value: unknown) => value is T,
  storage: PrefStorage = localStorage,
): T | undefined {
  const value = readAll(key, storage)[sessionId]
  return valid(value) ? value : undefined
}

export function writeSessionValue(
  key: string,
  sessionId: string,
  value: unknown,
  storage: PrefStorage = localStorage,
): void {
  const all = readAll(key, storage)
  delete all[sessionId]

  if (value !== undefined) all[sessionId] = value

  writePref(
    key,
    JSON.stringify(Object.fromEntries(Object.entries(all).slice(-MAX_SESSIONS))),
    storage,
  )
}
