<template>
  <ContextMenuPortal>
    <MenuContent
      data-slot="context-menu-content"
      v-bind="forwarded"
      side="bottom"
      align="start"
      :side-offset="4"
      :collision-padding="8"
      update-position-strategy="always"
      class="menu-surface surface-float z-(--z-drawer) max-h-(--reka-context-menu-content-available-height) min-w-(--size-context-menu) origin-(--reka-context-menu-content-transform-origin) text-ink opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-out) data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-fade_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
      :class="props.class"
      :style="contentStyle"
      @close-auto-focus="onCloseAutoFocus"
      @interact-outside="onInteractOutside"
    >
      <div class="menu-list max-h-(--reka-context-menu-content-available-height)">
        <slot />
      </div>
    </MenuContent>
  </ContextMenuPortal>
</template>

<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from "reka-ui"
import type { ComputedRef } from "vue"
import type { HTMLAttributes } from "vue"
import { ref } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuPortal, injectContextMenuRootContext, useForwardPropsEmits } from "reka-ui"
import { MenuContent } from "reka-ui/internal"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<ContextMenuContentProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const emits = defineEmits<ContextMenuContentEmits>()
const delegatedProps = reactiveOmit(props, "class")
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

<style src="../menu-surface.css"></style>
