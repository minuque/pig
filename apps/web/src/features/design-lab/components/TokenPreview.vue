<template>
  <div class="preview" :data-category="category">
    <template v-if="category === 'colors'">
      <span v-for="hue in HUES" :key="hue" class="dot" :style="{ background: `var(${hue})` }" />
    </template>

    <template v-else-if="category === 'typography'">
      <span class="type-big">Aa</span>
      <span class="type-small">Aa</span>
    </template>

    <template v-else-if="category === 'radius'">
      <span
        v-for="radius in RADII"
        :key="radius"
        class="corner"
        :style="{ borderStartStartRadius: `var(${radius})` }"
      />
    </template>

    <template v-else-if="category === 'shadows'">
      <span class="lift" :style="{ boxShadow: 'var(--shadow-popover)' }" />
      <span class="lift" :style="{ boxShadow: 'var(--shadow-dialog)' }" />
    </template>

    <template v-else-if="category === 'spacing'">
      <span v-for="space in SPACES" :key="space" class="step" :style="{ width: `var(${space})` }" />
    </template>

    <svg v-else-if="category === 'motion'" class="curve" viewBox="0 0 64 48" aria-hidden="true">
      <path class="curve-axis" d="M4 4 V44 H60" />
      <path d="M4 44 C 20 4, 36 4, 60 4" />
    </svg>

    <template v-else-if="category === 'sizes'">
      <span
        v-for="size in SIZES"
        :key="size"
        class="box"
        :style="{ inlineSize: `var(${size})`, blockSize: `var(${size})` }"
      />
    </template>

    <div v-else-if="category === 'layers'" class="stack">
      <span class="layer" />
      <span class="layer is-top" />
      <span class="layer" />
    </div>

    <template v-else>
      <span class="box is-material" />
      <span class="box is-material" :style="{ opacity: 'var(--opacity-disabled)' }" />
    </template>
  </div>
</template>

<script setup lang="ts">
// 总览卡片顶部的示意图，全部用真实 token 画
defineProps<{ category: string }>()

const HUES = [
  "--language-blue",
  "--language-green",
  "--language-yellow",
  "--language-orange",
  "--language-red",
  "--language-purple",
]
const RADII = ["--radius-control", "--radius-card", "--radius-dialog"]
const SPACES = ["--space-xs", "--space-sm", "--space-md", "--space-lg"]
const SIZES = ["--size-icon-xs", "--size-icon", "--size-icon-hero"]
</script>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  block-size: 96px;
  color: var(--contrast-foreground-secondary);
}

.dot {
  inline-size: var(--size-icon);
  block-size: var(--size-icon);
  border-radius: var(--radius-pill);
}

.type-big {
  color: var(--contrast-foreground);
  font-size: var(--text-heading);
  font-weight: var(--font-weight-semibold);
}

.type-small {
  font-size: var(--text-title);
}

.corner {
  inline-size: var(--space-xl);
  block-size: var(--space-xl);
  border-block-start: var(--border-width) solid currentColor;
  border-inline-start: var(--border-width) solid currentColor;
}

.lift {
  inline-size: var(--space-xxl);
  block-size: var(--space-xl);
  border-radius: var(--radius-control);
  background: var(--popover);
}

.step {
  block-size: var(--space-xl);
  border-radius: var(--radius-control);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.curve {
  inline-size: calc(var(--space-xxl) * 2);
  fill: none;
  stroke: currentColor;
  stroke-width: var(--line-icon-width);
}

.curve-axis {
  stroke: var(--border);
}

.box {
  border-radius: var(--radius-control);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.box.is-material {
  inline-size: var(--space-xl);
  block-size: var(--space-xl);
  background: var(--primary);
  box-shadow: none;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  inline-size: 40%;
}

.layer {
  block-size: var(--space-sm);
  border-radius: var(--radius-control);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.layer.is-top {
  background: var(--contrast-foreground);
  box-shadow: none;
}
</style>
