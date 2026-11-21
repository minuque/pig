import type { InjectionKey, Ref } from "vue"
import type { Node } from "comark"

export const LIVE_BLOCK: InjectionKey<Ref<Node | undefined>> = Symbol("markdown-live-block")
