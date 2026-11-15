/** 常驻摘要卡要的宽度：正文最小 640 + 卡片 280 + 间距 12 + 两侧留白 32 + 48（照 t3code）。 */
const RAIL_DOCKED_MIN = 1012

/** docked：卡片浮在正文右上角；popover：宽度不够，收成头部按钮弹的浮层。 */
export type RailMode = "docked" | "popover"

/** 摘要卡此刻的形态；右侧面板在面板列里，不占正文宽度。 */
export function railModeOf(width: number): RailMode {
  return width >= RAIL_DOCKED_MIN ? "docked" : "popover"
}
