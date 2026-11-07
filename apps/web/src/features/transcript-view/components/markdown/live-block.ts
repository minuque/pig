import type { InjectionKey, Ref } from "vue"
import type { Node } from "comark"

/** 流式中仍在增长的最后一个根块；代码块据此决定先显示纯文本。 */
export const LIVE_BLOCK: InjectionKey<Ref<Node | undefined>> = Symbol("markdown-live-block")
