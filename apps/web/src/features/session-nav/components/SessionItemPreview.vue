<template>
  <dl class="preview">
    <div class="row">
      <dt>标题</dt>
      <dd class="title">{{ title }}</dd>
    </div>

    <div class="row">
      <dt>模型</dt>

      <dd v-if="model" class="model">
        <img
          v-if="icon && !icon.tinted"
          class="vendor-mark"
          :src="icon.src"
          width="14"
          height="14"
          alt=""
        />

        <span v-else-if="icon" class="vendor-mark vendor-mark-mono" :style="monoStyle"></span>
        <span v-else class="vendor-mark vendor-fallback" :style="fallbackStyle">{{ letter }}</span>
        <span class="model-id">{{ model.id }}</span>
      </dd>

      <dd v-else>—</dd>
    </div>

    <div class="row">
      <dt>消息</dt>
      <dd>{{ messageCount === undefined ? "—" : `${messageCount} 条` }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { vendorDisplayName, vendorIcon } from "@features/composer/index.js"

const props = defineProps<{
  title: string
  model?: { provider: string; id: string }
  messageCount?: number
}>()

const icon = computed(() => (props.model ? vendorIcon(props.model.provider) : undefined))

const letter = computed(() => {
  if (!props.model) return "?"
  const label = vendorDisplayName(props.model.provider) || props.model.provider
  return label.charAt(0).toUpperCase() || "?"
})

const box = { width: "14px", height: "14px" }

const fallbackStyle = { ...box, fontSize: `${Math.max(8, 14 * 0.6)}px` }

const monoStyle = computed(() => ({
  ...box,
  webkitMaskImage: `url("${icon.value?.src}")`,
  maskImage: `url("${icon.value?.src}")`,
}))
</script>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: var(--size-menu);
  max-width: var(--size-settings-nav);
  margin: 0;
}

.row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

dt {
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-eyebrow--line-height);
}

dd {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
}

.title {
  overflow-wrap: anywhere;
  white-space: normal;
}

.model {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.model-id {
  min-width: 0;
  overflow-wrap: anywhere;
}

.vendor-mark {
  display: inline-block;
  flex: none;
  object-fit: contain;
  vertical-align: middle;
}

.vendor-mark-mono {
  color: var(--ink);
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

.vendor-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--canvas-soft);
  color: var(--ink-muted);
  font-weight: 600;
  line-height: 1;
}
</style>
