import { computed, shallowRef } from "vue"

interface LocalFont {
  family: string
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFont[]>
  }
}

const families = shallowRef<string[]>([])
let pending: Promise<void> | undefined

/** 窄字和宽字量出来一样宽就算等宽字体。 */
function isMonospace(ctx: CanvasRenderingContext2D, family: string): boolean {
  ctx.font = `16px ${JSON.stringify(family)}`
  return ctx.measureText("iiiiii").width === ctx.measureText("WWWWWW").width
}

/** 本机已装字体（Local Font Access API）；浏览器不支持或被拒时列表为空。 */
export function useLocalFonts() {
  const supported = typeof window !== "undefined" && typeof window.queryLocalFonts === "function"
  const mono = computed(() => {
    const ctx = document.createElement("canvas").getContext("2d")
    return ctx ? families.value.filter((family) => isMonospace(ctx, family)) : []
  })

  /** 要在用户操作里调：浏览器首次读取会弹授权。 */
  function load(): Promise<void> {
    if (!supported) return Promise.resolve()
    pending ??= window.queryLocalFonts!()
      .then((fonts) => {
        families.value = [...new Set(fonts.map((font) => font.family))].sort((a, b) =>
          a.localeCompare(b),
        )
      })
      .catch(() => {
        pending = undefined
      })
    return pending
  }

  return { supported, families, mono, load }
}
