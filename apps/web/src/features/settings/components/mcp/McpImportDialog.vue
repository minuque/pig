<template>
  <Dialog v-model:open="open">
    <DialogContent class="import-dialog">
      <DialogTitle>{{ t("settings.mcp.importJson") }}</DialogTitle>
      <DialogDescription>{{ t("settings.mcp.import.hint") }}</DialogDescription>

      <Textarea
        v-model="raw"
        size="s"
        class="import-input"
        spellcheck="false"
        :aria-label="t('settings.mcp.importJson')"
      />

      <Field v-if="parsed.single">
        <FieldLabel>{{ t("settings.mcp.import.singleName") }}</FieldLabel>
        <TextFieldRoot v-model="singleName" size="m" />
      </Field>

      <p v-if="parsed.error" class="import-error">{{ parsed.error }}</p>

      <ul v-else-if="candidates.length" class="import-list">
        <li v-for="item in candidates" :key="item.name" class="import-item">
          <span class="import-name">{{ item.name }}</span>

          <label v-if="item.conflict" class="import-overwrite">
            <Checkbox v-model="overwrite[item.name]" size="s" />
            {{ t("settings.mcp.import.overwrite") }}
          </label>
        </li>
      </ul>

      <p v-for="message in errors" :key="message" class="import-error">{{ message }}</p>

      <div class="import-footer">
        <DialogClose>
          <template #render="{ props: part }">
            <Button v-bind="part" type="button" size="s" variant="outline">
              {{ t("common.cancel") }}
            </Button>
          </template>
        </DialogClose>

        <Button type="button" size="s" :disabled="!selected.length" :loading="busy" @click="apply">
          {{ t("settings.mcp.import.confirm", { count: selected.length }) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue"

import type { McpState } from "@features/settings/hooks/use-mcp.js"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import { Checkbox } from "@pig/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@pig/ui/dialog"
import { Field, FieldLabel } from "@pig/ui/field"
import { TextFieldRoot } from "@pig/ui/text-field"
import { Textarea } from "@pig/ui/textarea"

type Entry = Record<string, unknown>

const props = defineProps<{ state: McpState }>()
const emit = defineEmits<{ imported: [] }>()
const open = defineModel<boolean>("open", { required: true })
const { t } = useI18n()
const raw = ref("")
const singleName = ref("")
const overwrite = reactive<Record<string, boolean>>({})
const errors = ref<string[]>([])
const busy = ref(false)
const isRecord = (value: unknown): value is Entry =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const parsed = computed<{ entries: [string, Entry][]; single?: Entry; error?: string }>(() => {
  if (!raw.value.trim()) return { entries: [] }

  try {
    const value: unknown = JSON.parse(raw.value)

    if (isRecord(value) && isRecord(value.mcpServers))
      return {
        entries: Object.entries(value.mcpServers).filter((entry): entry is [string, Entry] =>
          isRecord(entry[1]),
        ),
      }

    if (isRecord(value) && ("command" in value || "url" in value || "type" in value))
      return { entries: [], single: value }
    return { entries: [], error: t("settings.mcp.import.nothing") }
  } catch {
    return { entries: [], error: t("settings.mcp.import.parseError") }
  }
})
const candidates = computed(() => {
  const existing = new Set((props.state.view.value?.servers ?? []).map((s) => s.name))
  const entries = parsed.value.single
    ? singleName.value.trim()
      ? [[singleName.value.trim(), parsed.value.single] as [string, Entry]]
      : []
    : parsed.value.entries
  return entries.map(([name, config]) => ({ name, config, conflict: existing.has(name) }))
})
const selected = computed(() =>
  candidates.value.filter((item) => !item.conflict || overwrite[item.name]),
)

async function apply() {
  busy.value = true
  errors.value = []

  try {
    for (const item of selected.value) {
      const error = await props.state.save(item.name, item.config, { overwrite: item.conflict })

      if (error) errors.value.push(`${item.name}: ${error}`)
    }
  } finally {
    busy.value = false
  }

  if (errors.value.length) return
  raw.value = ""
  open.value = false
  emit("imported")
}
</script>

<style scoped>
.import-input {
  min-height: 12rem;
  margin-block: var(--space-sm);
  font-family: var(--font-mono);
}

.import-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.import-item,
.import-overwrite,
.import-footer {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.import-item {
  justify-content: space-between;
}

.import-name {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
}

.import-overwrite {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.import-error {
  margin: 0;
  color: var(--danger-text);
  font-size: var(--text-meta);
}

.import-footer {
  justify-content: flex-end;
  margin-block-start: var(--space-md);
}
</style>
