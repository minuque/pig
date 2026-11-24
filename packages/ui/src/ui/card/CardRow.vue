<script lang="ts">
import { defineComponent, type SlotsType } from "vue"
import { renderPart, type PartSlots } from "../part/index.js"

export default defineComponent({
  inheritAttrs: false,
  props: {
    bleed: { type: Boolean, default: false },
    interactive: { type: Boolean, default: false },
  },
  slots: Object as SlotsType<PartSlots>,
  setup(props, { attrs, slots }) {
    return () =>
      renderPart(slots, "div", {
        ...attrs,
        "data-slot": "card-row",
        "data-bleed": props.bleed || undefined,
        "data-interactive": props.interactive || undefined,
      })
  },
})
</script>

<style>
:where([data-slot="card-row"]) {
  padding-inline: var(--card-padding);
}

:where([data-slot="card-row"][data-bleed]) {
  padding-inline: 0;
}

:where([data-slot="card-row"]) + :where([data-slot="card-row"]) {
  box-shadow: var(--separator-top);
}

:where([data-slot="card-row"][data-interactive]) {
  transition: background-color var(--duration-fast) var(--ease-out);
}

:where([data-slot="card-row"][data-interactive]:hover) {
  background-color: var(--bg-hover);
}
</style>
