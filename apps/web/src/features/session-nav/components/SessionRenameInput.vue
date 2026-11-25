<template>
  <input
    ref="input"
    v-model="draft"
    class="rename-input"
    type="text"
    :aria-label="t('session.rename')"
    @click.stop
    @keydown.enter.prevent="emit('commit', draft)"
    @keydown.escape.prevent="emit('cancel')"
    @blur="emit('commit', draft)"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"

const props = defineProps<{ title: string }>()
const emit = defineEmits<{
  commit: [name: string]
  cancel: []
}>()
const { t } = useI18n()
const draft = ref(props.title)
const input = useTemplateRef<HTMLInputElement>("input")

onMounted(() => {
  input.value?.focus()
  input.value?.select()
})
</script>

<style scoped>
.rename-input {
  min-width: 0;
  flex: 1;
  height: calc(var(--control-2xs) + 1px);
  margin-block: -2px;
  padding: 0 var(--space-2xs);
  border: 0;
  border-radius: var(--radius-min);
  outline: none;
  background: var(--bg-muted);
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  box-shadow: inset 0 0 0 1px var(--accent-solid);
}
</style>
