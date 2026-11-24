<script lang="ts">
import { defineComponent, type HTMLAttributes, type PropType, type SlotsType } from "vue"
import type { Size, ToneColor } from "../../core/types.js"
import { renderPart, type PartSlots } from "../part/index.js"

const WEIGHT_CLASS = { regular: "font-normal", medium: "font-medium", bold: "font-bold" } as const

export default defineComponent({
  inheritAttrs: false,
  props: {
    class: {
      type: [String, Array, Object] as PropType<HTMLAttributes["class"]>,
      default: undefined,
    },
    size: { type: String as PropType<Size>, default: undefined },
    weight: { type: String as PropType<keyof typeof WEIGHT_CLASS>, default: undefined },
    underline: {
      type: String as PropType<"auto" | "always" | "hover" | "none">,
      default: "auto",
    },
    underlineStyle: { type: String as PropType<"solid" | "dotted">, default: "solid" },
    color: { type: String as PropType<ToneColor>, default: undefined },
    truncate: { type: Boolean, default: false },
  },
  slots: Object as SlotsType<PartSlots>,
  setup(props, { attrs, slots }) {
    return () =>
      renderPart(slots, "a", {
        ...attrs,
        "data-slot": "link",
        "data-size": props.size,
        "data-underline": props.underline,
        "data-underline-style": props.underlineStyle,
        "data-tone": props.color,
        class: [
          props.weight && WEIGHT_CLASS[props.weight],
          props.truncate && "truncate",
          props.class,
        ],
      })
  },
})
</script>

<style>
:where([data-slot="link"]) {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  text-align: inherit;
  color: var(--link);
  text-decoration-line: none;
  text-decoration-style: solid;
  text-decoration-thickness: min(2px, max(1px, 0.05em));
  text-underline-offset: calc(0.025em + 2px);
  text-decoration-color: currentColor;
}

:where([data-slot="link"][data-size="s"]) {
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="link"][data-size="m"]) {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="link"]:is(:any-link, button)) {
  cursor: pointer;
}

:where([data-slot="link"]:is(:disabled, [data-disabled])) {
  cursor: default;
}

:where([data-slot="link"][data-tone]) {
  color: var(--tone-text);
}

:where([data-slot="link"][data-underline="always"]) {
  text-decoration-line: underline;
}

@media (hover: hover) {
  :where(
    [data-slot="link"]:is(:any-link, button):is(
        [data-underline="auto"],
        [data-underline="hover"]
      ):hover
  ) {
    text-decoration-line: underline;
  }

  :where([data-slot="link"][data-underline-style="dotted"]:is(:any-link, button):hover) {
    text-decoration-line: none;
    background-image: radial-gradient(circle, currentColor 0.75px, transparent 1px);
    background-position: left bottom;
    background-repeat: repeat-x;
    background-size: 4px 2px;
  }
}

:where([data-slot="link"]:focus-visible) {
  text-decoration-line: none;
  border-radius: calc(var(--radius-control) / 3);
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
</style>
