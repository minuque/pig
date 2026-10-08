/**
 * localStorage 偏好读写收口。读写统一容错：隐私模式、配额满、JSON 损坏
 * 等失败一律回落默认值，偏好失效但页面可用。
 */

export type PrefStorage = Pick<Storage, "getItem" | "setItem">

/** 读原始字符串。key 不存在或存储不可用时返回 undefined。 */
export function readPref(key: string, storage: PrefStorage = localStorage): string | undefined {
  try {
    return storage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

/** 写原始字符串。写不进去时静默回落，偏好仅存活于本页。 */
export function writePref(key: string, value: string, storage: PrefStorage = localStorage): void {
  try {
    storage.setItem(key, value)
  } catch {
    /* 存储不可用时偏好仅存活于本页 */
  }
}

/** 读枚举值：存储值不在 allowed 里就用 fallback。 */
export function readEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  storage: PrefStorage = localStorage,
): T {
  const value = readPref(key, storage)
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** 读 on/off 开关：默认开，仅显式 "off" 视为关。 */
export function readFlag(key: string, storage: PrefStorage = localStorage): boolean {
  return readPref(key, storage) !== "off"
}

/** 写 on/off 开关。 */
export function writeFlag(key: string, on: boolean, storage: PrefStorage = localStorage): void {
  writePref(key, on ? "on" : "off", storage)
}

/** 读 JSON 数组并保留其中的字符串元素；非数组或解析失败返回 []。 */
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

/** 写 JSON。 */
export function writeJson(key: string, value: unknown, storage: PrefStorage = localStorage): void {
  writePref(key, JSON.stringify(value), storage)
}

/** 读正数字偏好：非有限数、非正数或空值返回 undefined。 */
export function readNumber(key: string, storage: PrefStorage = localStorage): number | undefined {
  const raw = readPref(key, storage)

  if (raw === undefined || raw.trim() === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** 写数字偏好。 */
export function writeNumber(key: string, value: number, storage: PrefStorage = localStorage): void {
  writePref(key, String(value), storage)
}
