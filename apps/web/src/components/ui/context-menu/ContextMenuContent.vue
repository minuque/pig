<template>
  <ContextMenuPortal>
    <ThemeRoot>
      <MenuContent
        data-slot="context-menu-content"
        v-bind="forwarded"
        side="bottom"
        align="start"
        :side-offset="4"
        :collision-padding="8"
        update-position-strategy="always"
        class="rt-BaseMenuContent rt-ContextMenuContent"
        :class="[sizeClass, variantClass, props.class]"
        :style="contentStyle"
        @close-auto-focus="onCloseAutoFocus"
        @interact-outside="onInteractOutside"
      >
        <div class="rt-BaseMenuViewport rt-ContextMenuViewport">
          <slot />
        </div>
      </MenuContent>
    </ThemeRoot>
  </ContextMenuPortal>
</template>

<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from "reka-ui"
import type { ComputedRef } from "vue"
import type { HTMLAttributes } from "vue"
import { computed, ref } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuPortal, injectContextMenuRootContext, useForwardPropsEmits } from "reka-ui"
import { MenuContent } from "reka-ui/internal"
import { ThemeRoot } from "@components/ui/rt/index.js"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    ContextMenuContentProps & {
      class?: HTMLAttributes["class"]
      size?: "1" | "2"
      variant?: "solid" | "soft"
    }
  >(),
  { class: undefined, size: "2", variant: "solid" },
)
const emits = defineEmits<ContextMenuContentEmits>()
const delegatedProps = reactiveOmit(props, "class", "size", "variant")
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<ContextMenuContentProps>
const root = injectContextMenuRootContext()
const interactedOutside = ref(false)
const contentStyle = {
  "--reka-context-menu-content-transform-origin": "var(--reka-popper-transform-origin)",
  "--reka-context-menu-content-available-width": "var(--reka-popper-available-width)",
  "--reka-context-menu-content-available-height": "var(--reka-popper-available-height)",
  "--reka-context-menu-trigger-width": "var(--reka-popper-anchor-width)",
  "--reka-context-menu-trigger-height": "var(--reka-popper-anchor-height)",
}
const sizeClass = computed(() => `rt-r-size-${props.size}`)
const variantClass = computed(() => `rt-variant-${props.variant}`)

function onCloseAutoFocus(event: Event) {
  if (!event.defaultPrevented && interactedOutside.value) event.preventDefault()
  interactedOutside.value = false
}

function onInteractOutside(event: CustomEvent<{ originalEvent: Event }>) {
  const original = event.detail.originalEvent

  if (
    original instanceof PointerEvent &&
    original.button === 2 &&
    event.target === root.triggerElement.value
  ) {
    event.preventDefault()
  }

  if (!event.defaultPrevented && !root.modal.value) interactedOutside.value = true
}
</script>
