<template>
  <Primitive
    data-slot="callout"
    :data-color="color"
    :data-size="size"
    :data-accent-color="accentColor"
    :as="as"
    :as-child="asChild"
    :class="[
      'rt-CalloutRoot',
      `rt-r-size-${rtSize}`,
      `rt-variant-${variant}`,
      highContrast && 'rt-high-contrast',
      'callout',
      dismissible && 'callout-dismissible',
      floating && 'surface-float',
      props.class,
    ]"
  >
    <div class="rt-CalloutIcon callout-icon">
      <slot name="icon" />
    </div>

    <div class="callout-content">
      <div v-if="$slots.title" class="rt-Text callout-title" :class="textSizeClass">
        <slot name="title" />
      </div>

      <div class="rt-Text callout-body" :class="textSizeClass">
        <slot />
      </div>
    </div>

    <button
      v-if="dismissible"
      type="button"
      class="callout-action"
      :aria-label="t('common.close')"
      @click="emit('close')"
    >
      <CloseIcon class="size-icon" />
    </button>
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Primitive } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { CloseIcon } from "@components/icons/index.js"
import { RT_SIZE, type Size } from "@components/ui/rt/size.js"
import { type CalloutColor, type CalloutVariant } from "./index.js"

const { t } = useI18n()

interface Props extends PrimitiveProps {
  variant?: CalloutVariant
  color?: CalloutColor
  size?: Size
  highContrast?: boolean
  dismissible?: boolean
  floating?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "div",
  asChild: false,
  variant: "soft",
  color: "neutral",
  size: "m",
  highContrast: false,
  dismissible: false,
  floating: false,
  class: undefined,
})
const emit = defineEmits<{ close: [] }>()
/** 项目语义色 → rt 的 accent 族：info 跟随当前 accent，中性走 gray 族。 */
const ACCENT_BY_COLOR: Record<CalloutColor, string | undefined> = {
  neutral: "gray",
  info: undefined,
  success: "green",
  warning: "orange",
  destructive: "red",
}
const rtSize = computed(() => RT_SIZE[props.size])
const accentColor = computed(() => ACCENT_BY_COLOR[props.color])
/** 照 rt 的 Callout.Text：1、2 档落到 text 2，3 档落到 text 3。 */
const textSizeClass = computed(() => `rt-r-size-${props.size === "l" ? "3" : "2"}`)
</script>

<style scoped>
/* 标题、正文、关闭键是项目扩展；底色、描边、尺寸由 rt 的 CalloutRoot 负责。 */
.callout {
  position: relative;
}

.callout-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-inline-size: 0;
}

.callout-dismissible .callout-content {
  padding-inline-end: var(--space-5);
}

.callout-title {
  font-weight: var(--font-weight-medium);
}

.callout-action {
  position: absolute;
  inset-block-start: var(--space-2);
  inset-inline-end: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 20px;
  block-size: 20px;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: currentColor;
  cursor: pointer;
}

.callout-action:hover {
  background: var(--hover-quiet);
}

.callout[data-size="s"] .callout-icon :deep(svg),
.callout[data-size="m"] .callout-icon :deep(svg) {
  inline-size: var(--size-icon);
  block-size: var(--size-icon);
}

.callout[data-size="l"] .callout-icon :deep(svg) {
  inline-size: var(--size-icon-2xs);
  block-size: var(--size-icon-2xs);
}
</style>
