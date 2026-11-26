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
const mono = computed(monospaceFamilies)
let pending: Promise<void> | undefined
let scanned: string[] | undefined
let scannedMono: string[] = []

function isMonospace(ctx: CanvasRenderingContext2D, family: string): boolean {
  ctx.font = `16px ${JSON.stringify(family)}`
  return ctx.measureText("iiiiii").width === ctx.measureText("WWWWWW").width
}

function monospaceFamilies(): string[] {
  const source = families.value

  if (source === scanned) return scannedMono
  const ctx = document.createElement("canvas").getContext("2d")
  scanned = source
  scannedMono = ctx ? source.filter((family) => isMonospace(ctx, family)) : []
  return scannedMono
}

export function useLocalFonts() {
  const supported = typeof window !== "undefined" && typeof window.queryLocalFonts === "function"

  // 外部：浏览器要求 queryLocalFonts 在用户操作里调用，首次读取会弹授权
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
