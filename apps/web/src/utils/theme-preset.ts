import { computed, effectScope, onScopeDispose, shallowRef, watch, type ComputedRef } from "vue"
import {
  DEFAULT_THEME_PRESET_ID,
  DERIVED_THEME_TOKENS,
  deriveThemeTokens,
  getThemePreset,
  THEME_PRESETS,
  type ThemePreset,
  type ThemePresetId,
} from "@pig/ui/theme"
import { readEnum, writePref } from "@utils/storage.js"
import { useIsDark } from "@utils/theme-mode.js"

const STORAGE_KEY = "pig.themePreset"
const PRESET_IDS = THEME_PRESETS.map((preset) => preset.id) as readonly ThemePresetId[]

type PresetState = {
  presetId: ComputedRef<ThemePresetId>
  preset: ComputedRef<ThemePreset>
  presets: readonly ThemePreset[]
  setPreset: (next: ThemePresetId) => void
}

let shared: PresetState | undefined
const scope = effectScope(true)

function applyPreset(preset: ThemePreset, isDark: boolean): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.dataset.themePreset = preset.id

  if (preset.id === DEFAULT_THEME_PRESET_ID) {
    for (const token of DERIVED_THEME_TOKENS) root.style.removeProperty(token)
    window.pigDesktop?.setThemeColor(isDark ? preset.dark.canvas : preset.light.canvas)
    return
  }

  const tokens = deriveThemeTokens(isDark ? preset.dark : preset.light, isDark)

  for (const token of DERIVED_THEME_TOKENS) root.style.setProperty(token, tokens[token])
  window.pigDesktop?.setThemeColor(tokens["--bg"])
}

function createPresetState(): PresetState {
  const isDark = useIsDark()
  const stored = shallowRef<ThemePresetId>(
    readEnum(STORAGE_KEY, PRESET_IDS, DEFAULT_THEME_PRESET_ID),
  )
  const presetId = computed(() => stored.value)
  const preset = computed(() => getThemePreset(stored.value))

  watch([preset, isDark], ([next, dark]) => applyPreset(next, dark), {
    immediate: true,
    flush: "sync",
  })

  if (typeof window !== "undefined") {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      stored.value = readEnum(STORAGE_KEY, PRESET_IDS, DEFAULT_THEME_PRESET_ID)
    }

    window.addEventListener("storage", onStorage)
    onScopeDispose(() => window.removeEventListener("storage", onStorage))
  }

  function setPreset(next: ThemePresetId): void {
    stored.value = next
    writePref(STORAGE_KEY, next)
  }

  return {
    presetId,
    preset,
    presets: THEME_PRESETS,
    setPreset,
  }
}

export function useThemePreset(): PresetState {
  shared ??= scope.run(createPresetState) as PresetState
  return shared
}
