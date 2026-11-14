/** 常驻摘要面板要的宽度：正文最小 640 + 面板 280 + 间距 12 + 两侧留白 32 + 48（照 t3code）。 */
const RAIL_DOCKED_MIN = 1012
/** 右侧面板两档宽度，与 tokens.css 的 --size-pane / --size-pane-wide 一致。 */
const PANE_WIDTH = { narrow: 440, wide: 880 } as const
const PANE_GAP = 12

/** docked：卡片常驻在正文右侧；popover：宽度不够，收成头部按钮弹的浮层。 */
export type RailMode = "docked" | "popover"

/** 摘要面板此刻的形态：右侧面板开着时，常驻门槛再加上它的宽度与外边距。 */
export function railModeOf(width: number, pane?: { wide: boolean }): RailMode {
  const need = pane ? (pane.wide ? PANE_WIDTH.wide : PANE_WIDTH.narrow) + PANE_GAP : 0
  return width >= RAIL_DOCKED_MIN + need ? "docked" : "popover"
}
