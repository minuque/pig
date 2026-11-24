import { computed, shallowRef, type ComputedRef } from "vue"
import type {
  UserPreferences,
  UserPreferencesPatch,
  UserRailLayout,
  UserRailSection,
} from "@/types/common-type.js"
import { readPref, readStringArray, writeJson, writePref } from "@utils/storage.js"
import { getPreferences, patchPreferences } from "./platform.js"

export const THEME_MODES = ["auto", "light", "dark"] as const
export const WELCOME_FIELDS = ["mask", "off"] as const
export const DENSITIES = ["compact", "normal"] as const
export const CODE_SIZES = [10, 11, 12, 13, 14, 15, 16] as const
export const LOCALES = ["en", "zh-CN"] as const
export const CHAT_WIDTHS = ["comfortable", "wide", "full"] as const
export const RAIL_SECTIONS = ["environment", "context", "tasks"] as const
const KEYS = {
  theme: "npg-theme",
  welcomeField: "pig.welcomeField",
  uiFont: "pig.uiFont",
  codeFont: "pig.codeFont",
  density: "pig.density",
  codeSize: "pig.codeSize",
  locale: "pig.locale",
  chatWidth: "pig.chatWidth",
  notify: "pig.notify",
  userName: "pig.userName",
  clickSound: "pig.clickSound",
  favoriteModels: "pig.favoriteModels",
  railLayout: "pig.rail.layout",
} as const
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "auto",
  welcomeField: "mask",
  uiFont: "",
  codeFont: "",
  density: "normal",
  codeSize: 13,
  locale: "zh-CN",
  chatWidth: "comfortable",
  notify: true,
  userName: "",
  clickSound: true,
  favoriteModels: [],
  railLayout: { closed: [], hidden: [] },
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function uniqueModels(value: readonly unknown[]): string[] {
  return [
    ...new Set(
      value.filter((item): item is string => typeof item === "string" && item.includes("/")),
    ),
  ]
}

function uniqueSections(value: unknown): UserRailSection[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter((item): item is UserRailSection =>
        RAIL_SECTIONS.includes(item as UserRailSection),
      ),
    ),
  ]
}

function readJsonPref(key: string): Record<string, unknown> | undefined {
  const raw = readPref(key)

  if (raw === undefined) return undefined

  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function readRailLayout(): UserRailLayout {
  const raw = readJsonPref(KEYS.railLayout) ?? {}
  return { closed: uniqueSections(raw.closed), hidden: uniqueSections(raw.hidden) }
}

function readCodeSize(): number {
  const value = Number(readPref(KEYS.codeSize))
  return CODE_SIZES.find((size) => size === value) ?? DEFAULT_PREFERENCES.codeSize
}

function readStored(): UserPreferences {
  return {
    theme: pick(readPref(KEYS.theme), THEME_MODES, DEFAULT_PREFERENCES.theme),
    welcomeField: pick(
      readPref(KEYS.welcomeField),
      WELCOME_FIELDS,
      DEFAULT_PREFERENCES.welcomeField,
    ),
    uiFont: readPref(KEYS.uiFont) ?? "",
    codeFont: readPref(KEYS.codeFont) ?? "",
    density: pick(readPref(KEYS.density), DENSITIES, DEFAULT_PREFERENCES.density),
    codeSize: readCodeSize(),
    locale: pick(readPref(KEYS.locale), LOCALES, DEFAULT_PREFERENCES.locale),
    chatWidth: pick(readPref(KEYS.chatWidth), CHAT_WIDTHS, DEFAULT_PREFERENCES.chatWidth),
    notify: readPref(KEYS.notify) !== "off",
    userName: readPref(KEYS.userName) ?? "",
    clickSound: readPref(KEYS.clickSound) !== "off",
    favoriteModels: uniqueModels(readStringArray(KEYS.favoriteModels)),
    railLayout: readRailLayout(),
  }
}

const SCALAR_KEYS = [
  "theme",
  "welcomeField",
  "uiFont",
  "codeFont",
  "density",
  "codeSize",
  "locale",
  "chatWidth",
  "notify",
  "clickSound",
] as const

function legacyPatch(): UserPreferencesPatch {
  const current = initial
  const patch: UserPreferencesPatch = {}

  for (const key of SCALAR_KEYS) {
    if (current[key] !== DEFAULT_PREFERENCES[key]) Object.assign(patch, { [key]: current[key] })
  }

  const userName = current.userName.trim()

  if (userName !== DEFAULT_PREFERENCES.userName) patch.userName = userName

  if (current.favoriteModels.length > 0) patch.favoriteModels = current.favoriteModels

  if (current.railLayout.closed.length > 0 || current.railLayout.hidden.length > 0)
    patch.railLayout = current.railLayout
  return patch
}

function writeMirror(preferences: UserPreferences): void {
  writePref(KEYS.theme, preferences.theme)
  writePref(KEYS.welcomeField, preferences.welcomeField)
  writePref(KEYS.uiFont, preferences.uiFont)
  writePref(KEYS.codeFont, preferences.codeFont)
  writePref(KEYS.density, preferences.density)
  writePref(KEYS.codeSize, String(preferences.codeSize))
  writePref(KEYS.locale, preferences.locale)
  writePref(KEYS.chatWidth, preferences.chatWidth)
  writePref(KEYS.notify, preferences.notify ? "on" : "off")
  writePref(KEYS.userName, preferences.userName)
  writePref(KEYS.clickSound, preferences.clickSound ? "on" : "off")
  writeJson(KEYS.favoriteModels, preferences.favoriteModels)
  writeJson(KEYS.railLayout, preferences.railLayout)
}

const initial = readStored()
const state = shallowRef<UserPreferences>(initial)
let pending: UserPreferencesPatch = {}
let inflight: UserPreferencesPatch = {}
let hydration: Promise<void> | undefined
let hydrateAttempted = false
let flushing = false
let synced = false
export const userPreferences: ComputedRef<UserPreferences> = computed(() => state.value)

async function flushPending(): Promise<void> {
  if (flushing || !synced) return
  flushing = true

  try {
    while (Object.keys(pending).length > 0) {
      const batch = pending

      pending = {}
      inflight = batch

      try {
        const server = await patchPreferences(batch)

        inflight = {}
        applyFromServer(server)
      } catch (error) {
        inflight = {}
        pending = { ...batch, ...pending }
        throw error
      }
    }
  } catch (error) {
    console.error("preferences patch failed:", error)
  } finally {
    flushing = false
  }
}

function applyFromServer(preferences: UserPreferences): void {
  const effective =
    Object.keys(inflight).length > 0 || Object.keys(pending).length > 0
      ? { ...preferences, ...inflight, ...pending }
      : preferences

  state.value = effective
  writeMirror(effective)
}

async function hydrate(): Promise<void> {
  hydrateAttempted = true

  try {
    const { preferences, exists } = await getPreferences()

    if (exists) {
      applyFromServer(preferences)
    } else {
      const patch = legacyPatch()

      if (Object.keys(patch).length > 0) applyFromServer(await patchPreferences(patch))
    }

    synced = true
    void flushPending()
  } catch (error) {
    console.error("preferences hydrate failed:", error)
  }
}

export function hydratePreferences(): Promise<void> {
  hydration ??= hydrate().finally(() => {
    hydration = undefined
  })
  return hydration
}

export function updatePreferences(patch: UserPreferencesPatch): void {
  const next = { ...state.value, ...patch }

  state.value = next
  writeMirror(next)
  pending = { ...pending, ...patch }

  if (synced) void flushPending()
  else if (hydrateAttempted) void hydratePreferences()
}

export function applyRemotePreferences(preferences: UserPreferences): void {
  applyFromServer(preferences)
}
