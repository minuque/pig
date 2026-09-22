import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from "vue"

// 被 Tooltip 包住的 popper 触发器，锚点会被 Tooltip 的 PopperRoot 遮住，内容侧要用这个显式取触发元素
const popperAnchorKey: InjectionKey<ShallowRef<HTMLElement | null>> = Symbol("popper-anchor")

export function providePopperAnchor(): ShallowRef<HTMLElement | null> {
  const anchor = shallowRef<HTMLElement | null>(null)
  provide(popperAnchorKey, anchor)
  return anchor
}

export function usePopperAnchor(): ShallowRef<HTMLElement | null> | undefined {
  return inject(popperAnchorKey, undefined)
}
