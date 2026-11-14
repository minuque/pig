<!-- 模型标签右侧的上下文占用圆环：轨道整圈，弧长即占比，按用量分档变色。 -->
<template>
  <svg
    class="context-ring"
    :data-severity="severity"
    viewBox="0 0 16 16"
    role="img"
    :aria-label="`${t('rail.context')} ${usage.percent}%`"
  >
    <circle class="ring-track" cx="8" cy="8" r="6.75" pathLength="100" />

    <circle
      class="ring-fill"
      cx="8"
      cy="8"
      r="6.75"
      pathLength="100"
      :stroke-dasharray="`${usage.percent} 100`"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { contextSeverity } from "@features/composer/lib/context-usage.js"
import type { ContextUsage } from "@features/composer/type.js"

const props = defineProps<{ usage: ContextUsage }>()
const { t } = useI18n()
const severity = computed(() => contextSeverity(props.usage.percent))
</script>

<style scoped>
.context-ring {
  flex: none;
  inline-size: var(--size-context-ring);
  block-size: var(--size-context-ring);
  rotate: -90deg;
  color: var(--primary);
}

.context-ring[data-severity="warning"] {
  color: var(--warning);
}

.context-ring[data-severity="critical"] {
  color: var(--danger);
}

.ring-track,
.ring-fill {
  fill: none;
  stroke-width: 2;
}

.ring-track {
  stroke: var(--fill-strong);
}

.ring-fill {
  stroke: currentColor;
  stroke-linecap: round;
  transition: stroke-dasharray var(--duration-slow) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .ring-fill {
    transition: none;
  }
}
</style>
