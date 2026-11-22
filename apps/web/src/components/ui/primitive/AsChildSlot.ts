import { cloneVNode, defineComponent, type PropType } from "vue"
import { findSingleVNode } from "./slot-vnode.js"

export const AsChildSlot = defineComponent({
  name: "AsChildSlot",
  inheritAttrs: false,
  props: {
    partProps: {
      type: Object as PropType<Record<string, unknown>>,
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => {
      const child = findSingleVNode(slots.default?.())

      if (!child) return null

      const rest = { ...props.partProps }
      delete rest["data-slot"]
      return cloneVNode(child, rest, true)
    }
  },
})
