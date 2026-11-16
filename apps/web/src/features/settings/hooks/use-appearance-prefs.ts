import { readonly, shallowRef } from "vue"
import { readEnum, readPref, writePref } from "@utils/storage.js"

export type WelcomeField = "mask" | "off"

/** 字号档：三种字号 S/M/L，M 是默认。 */
export type SizeTier = "s" | "m" | "l"

const WELCOME_FIELD_KEY = "pig.welcomeField"
const UI_FONT_KEY = "pig.uiFont"
const CODE_FONT_KEY = "pig.codeFont"
const UI_SIZE_KEY = "pig.uiSize"
const CODE_SIZE_KEY = "pig.codeSize"
const welcomeField = shallowRef<WelcomeField>("mask")
/** 空串表示用默认字体栈。 */
const uiFont = shallowRef("")
const codeFont = shallowRef("")
const uiSize = shallowRef<SizeTier>("m")
const codeSize = shallowRef<SizeTier>("m")
let loaded = false

/** 选中的字体排在默认栈前面，系统缺字时仍回落到默认栈。 */
function applyFont(token: "--font-sans" | "--font-mono", family: string): void {
  if (typeof document === "undefined") return
  const style = document.documentElement.style

  if (!family) style.removeProperty(token)
  else style.setProperty(token, `${JSON.stringify(family)}, var(${token}-default)`)
}

/** 字号档落在 html 的 data 属性上，由 tokens.css 按档覆盖字号 token。 */
function applySize(attribute: "data-ui-size" | "data-code-size", size: SizeTier): void {
  if (typeof document === "undefined") return
  document.documentElement.setAttribute(attribute, size)
}

function load(): void {
  if (loaded) return
  loaded = true
  welcomeField.value = readEnum(WELCOME_FIELD_KEY, ["mask", "off"] as const, "mask")
  uiFont.value = readPref(UI_FONT_KEY) ?? ""
  codeFont.value = readPref(CODE_FONT_KEY) ?? ""
  uiSize.value = readEnum(UI_SIZE_KEY, ["s", "m", "l"] as const, "m")
  codeSize.value = readEnum(CODE_SIZE_KEY, ["s", "m", "l"] as const, "m")
  applyFont("--font-sans", uiFont.value)
  applyFont("--font-mono", codeFont.value)
  applySize("data-ui-size", uiSize.value)
  applySize("data-code-size", codeSize.value)
}

/** 外观偏好：欢迎页背景、界面字体与字号、代码字体与字号。 */
export function useAppearancePrefs() {
  load()
  return {
    welcomeField: readonly(welcomeField),
    uiFont: readonly(uiFont),
    codeFont: readonly(codeFont),
    uiSize: readonly(uiSize),
    codeSize: readonly(codeSize),
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
    setUiSize(next: SizeTier) {
      uiSize.value = next
      writePref(UI_SIZE_KEY, next)
      applySize("data-ui-size", next)
    },
    setCodeSize(next: SizeTier) {
      codeSize.value = next
      writePref(CODE_SIZE_KEY, next)
      applySize("data-code-size", next)
    },
  }
}
