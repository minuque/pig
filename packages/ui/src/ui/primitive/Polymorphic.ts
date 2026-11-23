import { cloneVNode, defineComponent, h, type Component, type PropType } from "vue"
import { findSingleVNode } from "./slot-vnode.js"

export interface PolymorphicProps {
  as?: string | Component | undefined
  asChild?: boolean | undefined
}

export const Polymorphic = defineComponent({
  name: "UiPolymorphic",
  inheritAttrs: false,
  props: {
    as: {
      type: [String, Object, Function] as PropType<string | Component>,
      default: "div",
    },
    asChild: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { attrs, slots }) {
    return () => {
      if (props.asChild) {
        const child = findSingleVNode(slots.default?.())
        return child ? cloneVNode(child, attrs, true) : null
      }

      if (typeof props.as === "string") return h(props.as, attrs, slots.default?.())
      return h(props.as, attrs, slots)
    }
  },
})
