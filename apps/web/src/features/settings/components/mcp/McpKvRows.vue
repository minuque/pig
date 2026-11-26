<template>
  <div class="kv">
    <span class="kv-label">{{ label }}</span>

    <div v-for="(row, index) in rows" :key="index" class="kv-row">
      <TextFieldRoot
        v-model="row.key"
        size="s"
        class="kv-key"
        :aria-label="t('settings.mcp.form.key')"
      />

      <TextFieldRoot
        v-model="row.value"
        size="s"
        class="kv-value"
        :type="masked(row, index) ? 'password' : 'text'"
        :aria-label="t('settings.mcp.form.value')"
      >
        <TextFieldSlot v-if="!isReference(row.value)" side="right">
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            :aria-label="
              masked(row, index) ? t('settings.mcp.form.show') : t('settings.mcp.form.hide')
            "
            @click="toggle(index)"
          >
            <EyeIcon v-if="masked(row, index)" class="size-icon-sm" />
            <EyeOffIcon v-else class="size-icon-sm" />
          </IconButton>
        </TextFieldSlot>
      </TextFieldRoot>

      <IconButton
        type="button"
        size="s"
        variant="ghost"
        :aria-label="t('settings.mcp.form.removeRow')"
        @click="rows.splice(index, 1)"
      >
        <TrashIcon class="size-icon-sm" />
      </IconButton>
    </div>

    <Button
      type="button"
      size="s"
      variant="ghost"
      class="kv-add"
      @click="rows.push({ key: '', value: '' })"
    >
      <PlusIcon class="size-icon-sm" />
      {{ t("settings.mcp.form.addRow") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { EyeOffIcon } from "@lucide/vue"

import { EyeIcon, PlusIcon, TrashIcon } from "@components/icons/index.js"
import type { KvRow } from "@features/settings/lib/mcp-draft.js"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@pig/ui/button"
import { TextFieldRoot, TextFieldSlot } from "@pig/ui/text-field"

defineProps<{ label: string }>()

const rows = defineModel<KvRow[]>({ required: true })
const { t } = useI18n()
const shown = ref(new Set<number>())

function isReference(value: string) {
  return /^\$\{[^}]+\}$|^!/.test(value.trim()) || !value
}

function masked(row: KvRow, index: number) {
  return !isReference(row.value) && !shown.value.has(index)
}

function toggle(index: number) {
  const next = new Set(shown.value)

  if (next.has(index)) next.delete(index)
  else next.add(index)
  shown.value = next
}
</script>

<style scoped>
.kv {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.kv-label {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.kv-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto;
  align-items: center;
  gap: var(--space-xs);
}

.kv-key,
.kv-value {
  font-family: var(--font-mono);
}

.kv-add {
  align-self: flex-start;
}
</style>
