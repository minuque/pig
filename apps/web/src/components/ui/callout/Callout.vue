<template>
  <Primitive
    data-slot="callout"
    :data-variant="variant"
    :data-color="color"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="[
      'callout relative flex w-full flex-col rounded-(--radius-lg) border',
      calloutSize[size],
      calloutColor[color][variant],
      floating && 'surface-float',
      props.class,
    ]"
  >
    <div class="callout-header flex items-center gap-2">
      <span class="callout-icon flex items-center justify-center">
        <slot name="icon" />
      </span>

      <div class="min-w-0 flex-1 font-medium">
        <slot name="title" />
      </div>

      <button
        v-if="dismissible"
        type="button"
        class="callout-action flex size-5 items-center justify-center rounded-(--radius-sm)"
        :aria-label="t('common.close')"
        @click="emit('close')"
      >
        <CloseIcon class="size-3.5" />
      </button>
    </div>

    <div class="min-w-0 [&_p]:leading-relaxed">
      <slot />
    </div>
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { CloseIcon } from "@components/icons/index.js"
import {
  calloutColor,
  calloutSize,
  type CalloutColor,
  type CalloutSize,
  type CalloutVariant,
} from "./index.js"

const { t } = useI18n()

interface Props extends PrimitiveProps {
  variant?: CalloutVariant
  color?: CalloutColor
  size?: CalloutSize
  dismissible?: boolean
  floating?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "div",
  asChild: false,
  variant: "surface",
  color: "neutral",
  size: "2",
  dismissible: false,
  floating: false,
  class: undefined,
})
const emit = defineEmits<{ close: [] }>()
</script>

<style scoped>
.callout-action {
  color: var(--contrast-foreground-muted);
}

.callout-action:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.callout[data-size="1"] .callout-icon :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
}

.callout[data-size="2"] .callout-icon :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
}

.callout[data-size="3"] .callout-icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}
</style>
