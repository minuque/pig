/** 材质的窗口表面；写底色会顶掉系统材质，所以两者要错开。 */
export type BackgroundWindow = {
  setBackgroundColor(color: string): void
}

export type WindowBackground = {
  setThemeColor(color: string): void
  setTranslucent(on: boolean): void
}

/** 记住主题色：材质开着时写底色会把材质顶掉，等关掉材质再补回去。 */
export function createWindowBackground(
  getWindow: () => BackgroundWindow | undefined,
): WindowBackground {
  let themeColor: string | undefined
  let translucent = false
  return {
    setThemeColor(color) {
      themeColor = color

      if (!translucent) getWindow()?.setBackgroundColor(color)
    },
    setTranslucent(on) {
      translucent = on

      if (!on && themeColor) getWindow()?.setBackgroundColor(themeColor)
    },
  }
}
