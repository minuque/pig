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

    <span v-else class="composer">
      <span class="composer-send" />
    </span>
  </div>
</template>

<script setup lang="ts">
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
const SIZES = ["--icon-sm", "--icon-md", "--icon-xl"]
</script>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  block-size: 96px;
  color: var(--fg-secondary);
}

.dot {
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
  border-radius: var(--radius-pill);
}

.type-big {
  color: var(--fg);
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
  inline-size: var(--space-2xl);
  block-size: var(--space-xl);
  border-radius: var(--radius-control);
  background: var(--bg-raised);
  outline: var(--border-width) solid var(--border);
}

.step {
  flex: none;
  block-size: var(--space-xl);
  border-radius: var(--radius-control);
  background: var(--bg-emphasis);
}

.curve {
  inline-size: calc(var(--space-2xl) * 2);
  fill: none;
  stroke: currentColor;
  stroke-width: var(--icon-stroke);
}

.curve-axis {
  stroke: var(--border);
}

.box {
  flex: none;
  border-radius: var(--radius-control);
  background: var(--bg-emphasis);
}

.composer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  inline-size: 50%;
  block-size: var(--control-lg);
  padding-inline: var(--space-xs);
  border-radius: var(--composer-radius);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.composer-send {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
  border-radius: var(--radius-pill);
  background: var(--accent-solid);
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  inline-size: 40%;
}

.layer {
  block-size: var(--space-sm);
  border-radius: var(--radius-control);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.layer.is-top {
  background: var(--fg);
  box-shadow: none;
}
</style>
