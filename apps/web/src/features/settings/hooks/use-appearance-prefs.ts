import { computed, effectScope, watch } from "vue"
import {
  CODE_SIZES,
  CONTRAST_RANGE,
  DEFAULT_PREFERENCES,
  userPreferences,
  updatePreferences,
} from "@client/preferences.js"

export { CODE_SIZES, CONTRAST_RANGE }

const CODE_SIZE_DEFAULT = 13
const uiFont = computed(() => userPreferences.value.uiFont)
const codeFont = computed(() => userPreferences.value.codeFont)
const codeSize = computed(() => userPreferences.value.codeSize)
const contrast = computed(() => userPreferences.value.contrast)
let loaded = false

function applyFont(token: "--font-sans" | "--font-mono", family: string): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style

  if (!family) style.removeProperty(token)
  else style.setProperty(token, `${JSON.stringify(family)}, var(${token}-default)`)
}

function applyCodeSize(size: number): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style

  if (size === CODE_SIZE_DEFAULT) style.removeProperty("--text-code")
  else style.setProperty("--text-code", `${size}px`)
}

function applyContrast(value: number): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style
  const boost = Math.max(value - 100, 0)
  const entries = {
    "--contrast-base": `${Math.min(value, 100)}%`,
    "--contrast-boost": `${boost}%`,
  }

  for (const [name, next] of Object.entries(entries)) {
    if (value === DEFAULT_PREFERENCES.contrast) style.removeProperty(name)
    else style.setProperty(name, next)
  }
}

function load(): void {
  if (loaded) return
  loaded = true
  effectScope(true).run(() => {
    watch(
      [uiFont, codeFont, codeSize, contrast],
      ([nextUiFont, nextCodeFont, nextCodeSize, nextContrast]) => {
        applyFont("--font-sans", nextUiFont)
        applyFont("--font-mono", nextCodeFont)
        applyCodeSize(nextCodeSize)
        applyContrast(nextContrast)
      },
      { immediate: true, flush: "sync" },
    )
  })
}

export function useAppearancePrefs() {
  load()
  return {
    uiFont,
    codeFont,
    codeSize,
    contrast,
    setUiFont(next: string) {
      updatePreferences({ uiFont: next })
    },
    setCodeFont(next: string) {
      updatePreferences({ codeFont: next })
    },
    setCodeSize(next: number) {
      updatePreferences({ codeSize: next })
    },
    setContrast(next: number) {
      updatePreferences({ contrast: next })
    },
  }
}
