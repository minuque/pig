<template>
  <button
    type="button"
    class="selector thinking"
    :class="{ off: isOff }"
    :disabled="disabled"
    :aria-label="`思考强度：${label}`"
    :style="{ '--thinking-glow': glow }"
    @mousedown.prevent
    @click="cycle"
  >
    <span class="bars-slot" :class="{ on: !isOff }" aria-hidden="true">
      <svg class="bars" width="14" height="14" viewBox="0 0 14 14">
        <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" :style="{ opacity: barOpacities[0] }" />
        <rect
          x="5.75"
          y="5"
          width="2.5"
          height="7.5"
          rx="1"
          :style="{ opacity: barOpacities[1] }"
        />
        <rect x="10" y="2" width="2.5" height="10.5" rx="1" :style="{ opacity: barOpacities[2] }" />
      </svg>
    </span>
    <MorphingText class="level-name" :text="label" />
  </button>
</template>

<script lang="ts">
const OFF_LEVEL = "off";

/** 按档位数组循环；当前档不在列表时落到 0。 */
export function nextThinkingLevel(levels: readonly string[], current: string): string {
  if (levels.length === 0) return current;
  const i = levels.indexOf(current);
  return levels[i < 0 ? 0 : (i + 1) % levels.length]!;
}

/** 去掉 off 后的有效档；off 无信号格、无主题色。 */
export function activeThinkingLevels(levels: readonly string[]): string[] {
  return levels.filter((item) => item !== OFF_LEVEL);
}

/** 有效档从暗到亮：0 = secondary，1 = primary。off 返回 0。 */
export function thinkingGlow(level: string, levels: readonly string[]): number {
  if (level === OFF_LEVEL) return 0;
  const active = activeThinkingLevels(levels);
  if (active.length === 0) return 0;
  const i = active.indexOf(level);
  if (i < 0) return 0;
  if (active.length === 1) return 1;
  return i / (active.length - 1);
}

/** 三根条：off 全灭；其余按有效档从 1 根递到 3 根。 */
export function thinkingBarOpacities(
  level: string,
  levels: readonly string[],
): [number, number, number] {
  if (level === OFF_LEVEL) return [0, 0, 0];
  const active = activeThinkingLevels(levels);
  const i = Math.max(active.indexOf(level), 0);
  const n = Math.max(active.length, 1);
  const filled = n <= 1 ? 2 : Math.round((i / Math.max(n - 1, 1)) * 2);
  return [0, 1, 2].map((bar) => (bar <= filled ? 1 : 0.28)) as [number, number, number];
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import MorphingText from "@features/chat-input/components/MorphingText.vue";

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
const isOff = computed(() => props.level === OFF_LEVEL);
const barOpacities = computed(() => thinkingBarOpacities(props.level, props.levels));
const glow = computed(() => thinkingGlow(props.level, props.levels));

function cycle() {
  emit("update:level", nextThinkingLevel(props.levels, props.level));
}
</script>

<style scoped>
.thinking {
  gap: 0;
  font-weight: var(--font-weight-semibold);
}
.thinking:not(.off),
.thinking:not(.off):hover:not(:disabled) {
  color: color-mix(in srgb, var(--primary) calc(var(--thinking-glow) * 100%), var(--secondary));
}
.bars-slot {
  display: inline-flex;
  flex: none;
  width: 0;
  overflow: hidden;
  transition: width 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.bars-slot.on {
  width: 14px;
  margin-right: 4px;
}
.bars {
  flex: none;
  fill: currentColor;
}
.bars rect {
  transition: opacity 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.level-name {
  text-transform: capitalize;
  font-weight: inherit;
}
@media (prefers-reduced-motion: reduce) {
  .bars-slot,
  .bars rect {
    transition: none;
  }
}
</style>
