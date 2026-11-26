<script lang="ts">
import { defineComponent, type HTMLAttributes, type PropType, type SlotsType } from "vue"
import type { Size } from "../../core/types.js"
import { renderPart, type PartSlots } from "../part/index.js"

export default defineComponent({
  inheritAttrs: false,
  props: {
    class: {
      type: [String, Array, Object] as PropType<HTMLAttributes["class"]>,
      default: undefined,
    },
    size: { type: String as PropType<Size>, default: "m" },
    variant: { type: String as PropType<"surface" | "ghost">, default: "surface" },
  },
  slots: Object as SlotsType<PartSlots>,
  setup(props, { attrs, slots }) {
    return () =>
      renderPart(slots, "div", {
        ...attrs,
        "data-slot": "card",
        "data-size": props.size,
        "data-variant": props.variant,
        class: props.class,
      })
  },
})
</script>

<style>
:where([data-slot="card"]) {
  --card-border-radius: var(--radius-card);
  box-sizing: border-box;
  display: block;
  position: relative;
  overflow: hidden;
  padding: var(--card-padding);
  border-radius: var(--card-border-radius);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-normal);
  font-style: normal;
  text-align: start;
  contain: paint;
}

:where([data-slot="card"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-slot="card"][data-size="s"]) {
  --card-padding: var(--space-sm);
}

:where([data-slot="card"][data-size="m"]) {
  --card-padding: var(--space-md);
}

:where([data-slot="card"][data-variant="surface"]) {
  --card-background-color: var(--card-surface);
  border: var(--border-width) solid var(--border);
  background-color: var(--card-background-color);
  background-clip: padding-box;
  transition: border-color var(--duration-fast) var(--ease-out);
}

@media (hover: hover) {
  :where([data-slot="card"][data-variant="surface"]:is(:any-link, button, label):hover) {
    border-color: var(--border-strong);
  }
}

:where([data-slot="card"][data-variant="surface"]:is(:any-link, button, label):active) {
  border-color: var(--border);
}

:where([data-slot="card"][data-variant="ghost"]) {
  margin: calc(var(--card-padding) * -1);
}

@media (hover: hover) {
  :where([data-slot="card"][data-variant="ghost"]:is(:any-link, button, label):hover) {
    background-color: var(--bg-muted);
  }

  :where(
    [data-slot="card"][data-variant="ghost"]:is(:any-link, button, label):hover:focus-visible
  ) {
    background-color: var(--tone-subtle);
  }
}

@media (prefers-reduced-motion: reduce) {
  :where([data-slot="card"][data-variant="surface"]) {
    transition: none;
  }
}
</style>
