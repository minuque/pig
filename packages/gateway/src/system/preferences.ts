import { watch, type FSWatcher } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { basename, dirname } from "node:path"
import type {
  UserPreferences,
  UserPreferencesPatch,
  UserRailLayout,
  UserRailSection,
} from "@pig/protocol"
import { pigHomeFile, writeJsonAtomic } from "./pig-file.js"

const DEBOUNCE_MS = 80
const THEME_MODES = ["auto", "light", "dark"] as const
const THEME_PRESETS = ["linear", "paper", "ocean", "grove", "iris"] as const
const WELCOME_FIELDS = ["mask", "off"] as const
const UI_SIZES = ["s", "m", "l"] as const
const LOCALES = ["en", "zh-CN"] as const
const CHAT_WIDTHS = ["comfortable", "wide", "full"] as const
export const CODE_SIZES = [10, 11, 12, 13, 14, 15, 16] as const
export const RAIL_SECTIONS = ["environment", "context", "tasks"] as const
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "auto",
  themePreset: "linear",
  welcomeField: "mask",
  uiFont: "",
  codeFont: "",
  uiSize: "m",
  codeSize: 13,
  locale: "zh-CN",
  chatWidth: "comfortable",
  notify: true,
  userName: "",
  clickSound: true,
  favoriteModels: [],
  railLayout: { closed: [], hidden: [] },
}

export class PreferencesError extends Error {}

export class PreferencesCorruptedError extends Error {
  constructor(message = "preferences.json 无法解析，拒绝覆写") {
    super(message)
  }
}

type Loaded =
  { state: "missing" } | { state: "corrupt" } | { state: "ok"; raw: Record<string, unknown> }

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function requiredOneOf<T extends string>(field: string, value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new PreferencesError(`${field} 取值不合法`)
  return value as T
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function modelKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter((item): item is string => typeof item === "string" && item.includes("/")),
    ),
  ]
}

function railSections(value: unknown): UserRailSection[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter((item): item is UserRailSection =>
        RAIL_SECTIONS.includes(item as UserRailSection),
      ),
    ),
  ]
}

function railLayout(value: unknown): UserRailLayout {
  const raw = typeof value === "object" && value !== null ? (value as Partial<UserRailLayout>) : {}
  return { closed: railSections(raw.closed), hidden: railSections(raw.hidden) }
}

function normalizePreferences(raw: Record<string, unknown>): UserPreferences {
  const codeSize = CODE_SIZES.find((size) => size === raw.codeSize)
  return {
    theme: oneOf(raw.theme, THEME_MODES, DEFAULT_PREFERENCES.theme),
    themePreset: oneOf(raw.themePreset, THEME_PRESETS, DEFAULT_PREFERENCES.themePreset),
    welcomeField: oneOf(raw.welcomeField, WELCOME_FIELDS, DEFAULT_PREFERENCES.welcomeField),
    uiFont: text(raw.uiFont, DEFAULT_PREFERENCES.uiFont),
    codeFont: text(raw.codeFont, DEFAULT_PREFERENCES.codeFont),
    uiSize: oneOf(raw.uiSize, UI_SIZES, DEFAULT_PREFERENCES.uiSize),
    codeSize: codeSize ?? DEFAULT_PREFERENCES.codeSize,
    locale: oneOf(raw.locale, LOCALES, DEFAULT_PREFERENCES.locale),
    chatWidth: oneOf(raw.chatWidth, CHAT_WIDTHS, DEFAULT_PREFERENCES.chatWidth),
    notify: flag(raw.notify, DEFAULT_PREFERENCES.notify),
    userName: text(raw.userName, DEFAULT_PREFERENCES.userName),
    clickSound: flag(raw.clickSound, DEFAULT_PREFERENCES.clickSound),
    favoriteModels: modelKeys(raw.favoriteModels),
    railLayout: railLayout(raw.railLayout),
  }
}

function patchEntry(input: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(input, key)
}

function pickPatch(input: Record<string, unknown>): UserPreferencesPatch {
  const patch: UserPreferencesPatch = {}
  const unknown = Object.keys(input).filter((key) => !Object.hasOwn(DEFAULT_PREFERENCES, key))

  if (unknown.length > 0) throw new PreferencesError(`未知偏好字段：${unknown.join(", ")}`)

  if (patchEntry(input, "theme")) patch.theme = requiredOneOf("theme", input.theme, THEME_MODES)

  if (patchEntry(input, "themePreset"))
    patch.themePreset = requiredOneOf("themePreset", input.themePreset, THEME_PRESETS)

  if (patchEntry(input, "welcomeField"))
    patch.welcomeField = requiredOneOf("welcomeField", input.welcomeField, WELCOME_FIELDS)

  if (patchEntry(input, "uiFont")) patch.uiFont = requiredText("uiFont", input.uiFont)

  if (patchEntry(input, "codeFont")) patch.codeFont = requiredText("codeFont", input.codeFont)

  if (patchEntry(input, "uiSize")) patch.uiSize = requiredOneOf("uiSize", input.uiSize, UI_SIZES)

  if (patchEntry(input, "codeSize")) {
    const size = CODE_SIZES.find((item) => item === input.codeSize)

    if (size === undefined) throw new PreferencesError("codeSize 取值不合法")
    patch.codeSize = size
  }

  if (patchEntry(input, "locale")) patch.locale = requiredOneOf("locale", input.locale, LOCALES)

  if (patchEntry(input, "chatWidth"))
    patch.chatWidth = requiredOneOf("chatWidth", input.chatWidth, CHAT_WIDTHS)

  if (patchEntry(input, "notify")) patch.notify = requiredFlag("notify", input.notify)

  if (patchEntry(input, "userName"))
    patch.userName = requiredText("userName", input.userName).trim()

  if (patchEntry(input, "clickSound"))
    patch.clickSound = requiredFlag("clickSound", input.clickSound)

  if (patchEntry(input, "favoriteModels")) {
    if (
      !Array.isArray(input.favoriteModels) ||
      input.favoriteModels.some((item) => typeof item !== "string")
    )
      throw new PreferencesError("favoriteModels 必须是字符串数组")
    patch.favoriteModels = modelKeys(input.favoriteModels)
  }

  if (patchEntry(input, "railLayout")) patch.railLayout = requiredRailLayout(input.railLayout)
  return patch
}

function requiredText(field: string, value: unknown): string {
  if (typeof value !== "string") throw new PreferencesError(`${field} 必须是字符串`)
  return value
}

function requiredFlag(field: string, value: unknown): boolean {
  if (typeof value !== "boolean") throw new PreferencesError(`${field} 必须是布尔值`)
  return value
}

function requiredRailLayout(value: unknown): UserRailLayout {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}

  if (!Array.isArray(raw.closed) || !Array.isArray(raw.hidden))
    throw new PreferencesError("railLayout 必须是 { closed, hidden } 数组")

  for (const list of [raw.closed, raw.hidden]) {
    if (list.some((item) => !RAIL_SECTIONS.includes(item as UserRailSection)))
      throw new PreferencesError("railLayout 含未知分区")
  }

  return { closed: railSections(raw.closed), hidden: railSections(raw.hidden) }
}

export function preferencesFile(sessionDir?: string, pigHome?: string): string {
  return pigHomeFile("preferences.json", sessionDir, pigHome)
}

export class PreferencesStore {
  private queue: Promise<unknown> = Promise.resolve()
  private snapshot: string | undefined
  private watcher: FSWatcher | undefined
  private timer: NodeJS.Timeout | undefined
  private onChange: ((preferences: UserPreferences) => void) | undefined
  private attaching: Promise<void> | undefined
  private closed = true

  constructor(readonly path: string) {}

  async read(): Promise<{ preferences: UserPreferences; exists: boolean }> {
    const loaded = await this.load().catch((error): Loaded => {
      console.error("preferences read failed:", error)
      return { state: "missing" }
    })

    if (loaded.state === "missing") return { preferences: normalizePreferences({}), exists: false }

    if (loaded.state === "corrupt") {
      // 外部：用户手改出语法错误时保留原文件，界面回退默认值
      console.error("preferences.json 无法解析，回退默认值")
      return { preferences: normalizePreferences({}), exists: true }
    }

    return { preferences: normalizePreferences(loaded.raw), exists: true }
  }

  patch(input: Record<string, unknown>): Promise<UserPreferences> {
    const run = this.queue.then(async () => {
      const change = pickPatch(input)

      if (Object.keys(change).length === 0) return (await this.read()).preferences

      const loaded = await this.load()

      if (loaded.state === "corrupt") throw new PreferencesCorruptedError()
      const merged = { ...(loaded.state === "ok" ? loaded.raw : {}), ...change }

      await this.write(merged)
      return this.commit(normalizePreferences(merged))
    })

    this.queue = run.catch(() => undefined)
    return run
  }

  watch(onChange: (preferences: UserPreferences) => void): void {
    this.onChange = onChange
    this.closed = false
    void this.attach()
  }

  close(): void {
    this.closed = true

    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.onChange = undefined

    if (this.watcher) this.watcher.close()
    this.watcher = undefined
  }

  private async load(): Promise<Loaded> {
    let text: string

    try {
      text = await readFile(this.path, "utf-8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: "missing" }
      throw error
    }

    try {
      const parsed: unknown = JSON.parse(text)

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return { state: "corrupt" }
      return { state: "ok", raw: parsed as Record<string, unknown> }
    } catch {
      return { state: "corrupt" }
    }
  }

  private async write(config: Record<string, unknown>): Promise<void> {
    await writeJsonAtomic(this.path, config)
    await this.attach()
  }

  private commit(preferences: UserPreferences): UserPreferences {
    const key = JSON.stringify(preferences)

    if (key === this.snapshot) return preferences
    this.snapshot = key
    this.notify(preferences)
    return preferences
  }

  private notify(preferences: UserPreferences): void {
    try {
      this.onChange?.(preferences)
    } catch (error) {
      console.error("preferences listener failed:", error)
    }
  }

  private attach(): Promise<void> {
    if (this.watcher || this.closed) return Promise.resolve()
    this.attaching ??= this.openWatcher().finally(() => {
      this.attaching = undefined
    })
    return this.attaching
  }

  private async openWatcher(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true }).catch(() => undefined)

    if (this.watcher || this.closed) return

    const name = basename(this.path).toLowerCase()
    const loaded = await this.load().catch(() => undefined)

    if (loaded?.state === "ok" && this.snapshot === undefined)
      this.snapshot = JSON.stringify(normalizePreferences(loaded.raw))

    try {
      const watcher = watch(dirname(this.path), (_event, filename) => {
        if (filename && filename.toString().toLowerCase() !== name) return
        this.schedule()
      })

      watcher.on("error", () => {
        watcher.close()

        if (this.watcher === watcher) this.watcher = undefined
      })
      watcher.unref()
      this.watcher = watcher
    } catch {
      this.watcher = undefined
    }
  }

  private schedule(): void {
    if (this.timer || this.closed) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.flush()
    }, DEBOUNCE_MS)
    this.timer.unref()
  }

  private flush(): Promise<void> {
    const run = this.queue.then(async () => {
      if (this.closed) return
      const loaded = await this.load().catch(() => undefined)

      if (loaded?.state !== "ok") return
      this.commit(normalizePreferences(loaded.raw))
    })

    this.queue = run.catch(() => undefined)
    return run
  }
}
