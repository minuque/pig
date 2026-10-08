/** 侧栏吸顶偏移：置顶区钉顶，会话表头与目录头依次吸在其下。 */

export interface StickyOffsets {
  /** 会话表头的吸顶位置 */
  pin: number
  /** 目录头的吸顶位置 */
  head: number
  /** 滚动容器尾部留白，保证滚到底时置顶区仍停在顶部 */
  tail: number
}

export function stickyOffsets(
  pinHeight: number,
  headHeight: number,
  gap: number,
  paddingTop: number,
): StickyOffsets {
  // 置顶区自带底边距，吸顶位置要扣掉它，否则表头吸上去会跳一格
  const pin = Math.max(0, pinHeight - gap)
  const head = pin + headHeight
  // 置顶区比容器内边距高时，滚到底会被顶出视口
  const tail = Math.max(0, head - paddingTop)
  return { pin, head, tail }
}
