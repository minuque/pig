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
      class="context-menu-surface z-(--z-drawer) max-h-(--reka-context-menu-content-available-height) min-w-(--size-context-menu) origin-(--reka-context-menu-content-transform-origin) text-ink opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-out) data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-fade_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
      :class="props.class"
      :style="contentStyle"
      @close-auto-focus="onCloseAutoFocus"
      @interact-outside="onInteractOutside"
    >
      <div class="context-menu-list">
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

<style>
.context-menu-surface {
  position: relative;
  overflow: hidden;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--menu-surface);
  box-shadow: var(--shadow-elevated);
}

.context-menu-surface::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  backdrop-filter: blur(var(--menu-blur)) saturate(1.5);
}

.context-menu-list {
  position: relative;
  z-index: 1;
  max-height: var(--reka-context-menu-content-available-height);
  overflow: auto;
  padding: var(--spacing-xxs);
}
</style>
