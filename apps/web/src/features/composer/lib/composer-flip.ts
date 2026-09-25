/** compact↔expanded 折叠决策：换行一律展开；容量是布局稳定量，绝不用折叠后的测量值回灌。 */

/** 低于此宽度永远展开，单行挤不下动作行。 */
export const MIN_COMPACT_CAPACITY = 200
/** 展开↔折叠的滞回间隙，避免在阈值附近抖动。 */
export const COLLAPSE_HYSTERESIS = 32
/** 拖窗口/拖宽度手柄期间折叠延后，展开仍然立即。 */
export const RESIZE_SETTLE_MS = 150
/** compact↔expanded 高度形变：对齐 Zeron COLLAPSE。 */
export const FLIP_MS = 180

export interface ComposerFlipInput {
  /** 正文含换行：多行内容没有紧凑态。 */
  hasNewline: boolean
  /** 单行文本的测量宽度（px）。 */
  textWidth: number
  /** 紧凑态下输入区可用的稳定宽度（px）。 */
  capacity: number
  expanded: boolean
  /** 尺寸变化未落定：此期间不折叠。 */
  resizing: boolean
}

export function composerFlip(input: ComposerFlipInput): boolean {
  if (input.hasNewline) return true

  if (input.capacity < MIN_COMPACT_CAPACITY) return true

  if (!input.expanded) return input.textWidth > input.capacity

  if (input.resizing) return true
  return input.textWidth >= input.capacity - COLLAPSE_HYSTERESIS
}
