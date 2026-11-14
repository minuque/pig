import { readonly, shallowRef } from "vue"
import { readEnum, readPref, writePref } from "@utils/storage.js"

export type WelcomeField = "mask" | "off"

const WELCOME_FIELD_KEY = "pig.welcomeField"
const UI_FONT_KEY = "pig.uiFont"
const CODE_FONT_KEY = "pig.codeFont"
const welcomeField = shallowRef<WelcomeField>("mask")
/** 空串表示用默认字体栈。 */
const uiFont = shallowRef("")
const codeFont = shallowRef("")
let loaded = false

/** 选中的字体排在默认栈前面，系统缺字时仍回落到默认栈。 */
function applyFont(token: "--font-sans" | "--font-mono", family: string): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style

  if (!family) style.removeProperty(token)
  else style.setProperty(token, `${JSON.stringify(family)}, var(${token}-default)`)
}

function load(): void {
  if (loaded) return
  loaded = true
  welcomeField.value = readEnum(WELCOME_FIELD_KEY, ["mask", "off"] as const, "mask")
  uiFont.value = readPref(UI_FONT_KEY) ?? ""
  codeFont.value = readPref(CODE_FONT_KEY) ?? ""
  applyFont("--font-sans", uiFont.value)
  applyFont("--font-mono", codeFont.value)
}

/** 外观偏好：欢迎页背景、界面字体、代码字体。 */
export function useAppearancePrefs() {
  load()
  return {
    welcomeField: readonly(welcomeField),
    uiFont: readonly(uiFont),
    codeFont: readonly(codeFont),
    setWelcomeField(next: WelcomeField) {
      welcomeField.value = next
      writePref(WELCOME_FIELD_KEY, next)
    },
    setUiFont(next: string) {
      uiFont.value = next
      writePref(UI_FONT_KEY, next)
      applyFont("--font-sans", next)
    },
    setCodeFont(next: string) {
      codeFont.value = next
      writePref(CODE_FONT_KEY, next)
      applyFont("--font-mono", next)
    },
  }
}
