<template>
  <button
    type="button"
    class="selector thinking"
    :disabled="disabled"
    :aria-label="`思考强度：${label}`"
    :style="{ '--thinking-depth': depth }"
    @mousedown.prevent
    @click="cycle"
  >
    <svg class="bars" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1" y="9" width="3" height="4" rx="0.8" :opacity="barOpacities[0]" />
      <rect x="5.5" y="5.5" width="3" height="7.5" rx="0.8" :opacity="barOpacities[1]" />
      <rect x="10" y="2" width="3" height="11" rx="0.8" :opacity="barOpacities[2]" />
    </svg>
    <span class="level-name">{{ label }}</span>
  </button>
</template>

<script lang="ts">
/** 按档位数组循环；当前档不在列表时落到 0。 */
export function nextThinkingLevel(levels: readonly string[], current: string): string {
  if (levels.length === 0) return current;
  const i = levels.indexOf(current);
  return levels[i < 0 ? 0 : (i + 1) % levels.length]!;
}

/** 档位在列表中的深度：0 最浅（主题色），1 最深（偏向 secondary）。 */
export function thinkingDepth(index: number, count: number): number {
  if (count <= 1) return 0;
  return Math.max(0, Math.min(1, index / (count - 1)));
}

/** 三根条的透明度：由当前 index 相对档位数映射，不写死档名。 */
export function thinkingBarOpacities(index: number, count: number): [number, number, number] {
  const n = Math.max(count, 1);
  const i = Math.max(index, 0);
  const filled = n <= 1 ? 2 : Math.round((i / Math.max(n - 1, 1)) * 2);
  return [0, 1, 2].map((bar) => (bar <= filled ? 1 : 0.28)) as [number, number, number];
}
</script>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    levels: string[];
    level: string;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  "update:level": [value: string];
}>();

const label = computed(() => props.level.charAt(0).toUpperCase() + props.level.slice(1));
const currentIndex = computed(() => Math.max(props.levels.indexOf(props.level), 0));
const barOpacities = computed(() => thinkingBarOpacities(currentIndex.value, props.levels.length));
const depth = computed(() => thinkingDepth(currentIndex.value, props.levels.length));

function cycle() {
  emit("update:level", nextThinkingLevel(props.levels, props.level));
}
</script>

<style scoped>
.thinking,
.thinking:hover:not(:disabled) {
  color: color-mix(in srgb, var(--secondary) calc(var(--thinking-depth) * 72%), var(--primary));
}
.bars {
  flex: none;
  fill: currentColor;
}
.level-name {
  text-transform: capitalize;
}
</style>
