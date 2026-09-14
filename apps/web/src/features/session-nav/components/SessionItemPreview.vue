<template>
  <dl class="preview">
    <div class="row">
      <dt>标题</dt>
      <dd class="title">{{ title }}</dd>
    </div>

    <div class="row">
      <dt>模型</dt>

      <dd v-if="model" class="model">
        <VendorMark :vendor="model.provider" :size="14" />
        <span>{{ model.id }}</span>
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
import VendorMark from "@features/composer/components/VendorMark.vue"

defineProps<{
  title: string
  model?: { provider: string; id: string }
  messageCount?: number
}>()
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

.model span {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
