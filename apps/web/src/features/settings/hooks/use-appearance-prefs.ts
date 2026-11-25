import { computed, effectScope, watch } from "vue"
import { CODE_SIZES, userPreferences, updatePreferences } from "@client/preferences.js"

export type WelcomeField = "mask" | "off"

export { CODE_SIZES }

const CODE_SIZE_DEFAULT = 13
const welcomeField = computed(() => userPreferences.value.welcomeField)
const uiFont = computed(() => userPreferences.value.uiFont)
const codeFont = computed(() => userPreferences.value.codeFont)
const codeSize = computed(() => userPreferences.value.codeSize)
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

function load(): void {
  if (loaded) return
  loaded = true
  effectScope(true).run(() => {
    watch(
      [uiFont, codeFont, codeSize],
      ([nextUiFont, nextCodeFont, nextCodeSize]) => {
        applyFont("--font-sans", nextUiFont)
        applyFont("--font-mono", nextCodeFont)
        applyCodeSize(nextCodeSize)
      },
      { immediate: true, flush: "sync" },
    )
  })
}

export function useAppearancePrefs() {
  load()
  return {
    welcomeField,
    uiFont,
    codeFont,
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
    setCodeSize(next: number) {
      updatePreferences({ codeSize: next })
    },
  }
}
