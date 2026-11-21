import { computed, watch } from "vue"
import { CODE_SIZES, userPreferences, updatePreferences } from "@client/preferences.js"

export type WelcomeField = "mask" | "off"

export type SizeTier = "s" | "m" | "l"

export { CODE_SIZES }

const CODE_SIZE_DEFAULT = 13
const welcomeField = computed(() => userPreferences.value.welcomeField)
const uiFont = computed(() => userPreferences.value.uiFont)
const codeFont = computed(() => userPreferences.value.codeFont)
const uiSize = computed(() => userPreferences.value.uiSize)
const codeSize = computed(() => userPreferences.value.codeSize)
let loaded = false

function applyFont(token: "--font-sans" | "--font-mono", family: string): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style

  if (!family) style.removeProperty(token)
  else style.setProperty(token, `${JSON.stringify(family)}, var(${token}-default)`)
}

function applyUiSize(size: SizeTier): void {
  if (typeof document === "undefined") return
  document.documentElement.dataset.uiSize = size
}

function applyCodeSize(size: number): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style

  if (size === CODE_SIZE_DEFAULT) style.removeProperty("--text-code")
  else style.setProperty("--text-code", `${size}px`)
}

function load(): void {
  if (loaded) return
  loaded = true
  watch(
    [uiFont, codeFont, uiSize, codeSize],
    ([nextUiFont, nextCodeFont, nextUiSize, nextCodeSize]) => {
      applyFont("--font-sans", nextUiFont)
      applyFont("--font-mono", nextCodeFont)
      applyUiSize(nextUiSize)
      applyCodeSize(nextCodeSize)
    },
    { immediate: true, flush: "sync" },
  )
}

export function useAppearancePrefs() {
  load()
  return {
    welcomeField,
    uiFont,
    codeFont,
    uiSize,
    codeSize,
    setWelcomeField(next: WelcomeField) {
      updatePreferences({ welcomeField: next })
    },
    setUiFont(next: string) {
      updatePreferences({ uiFont: next })
    },
    setCodeFont(next: string) {
      updatePreferences({ codeFont: next })
    },
    setUiSize(next: SizeTier) {
      updatePreferences({ uiSize: next })
    },
    setCodeSize(next: number) {
      updatePreferences({ codeSize: next })
    },
  }
}
