/** 流式立刻画；历史重节点等进视口且滚动停下。 */
export function shouldHydrateHeavy(
  streaming: boolean,
  inView: boolean,
  scrollIdle: boolean,
): boolean {
  return streaming || (inView && scrollIdle)
}
