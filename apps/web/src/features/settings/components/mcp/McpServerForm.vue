<template>
  <form class="mcp-form" @submit.prevent="submit">
    <div v-if="!server" class="form-top">
      <Button type="button" size="s" variant="outline" @click="emit('import')">
        <BracesIcon class="size-icon-sm" />
        {{ t("settings.mcp.importJson") }}
      </Button>
    </div>

    <Field>
      <FieldLabel>{{ t("settings.mcp.form.name") }}</FieldLabel>
      <TextFieldRoot v-model="draft.name" size="m" class="mono" :invalid="Boolean(nameError)" />
      <span v-if="nameError" class="form-error">{{ nameError }}</span>
    </Field>

    <TabsRoot v-model="draft.transport">
      <TabsList variant="segmented" size="s" :aria-label="t('settings.mcp.form.transport')">
        <TabsTrigger value="stdio">{{ t("settings.mcp.form.stdio") }}</TabsTrigger>
        <TabsTrigger value="http">{{ t("settings.mcp.form.http") }}</TabsTrigger>
      </TabsList>
    </TabsRoot>

    <template v-if="draft.transport === 'stdio'">
      <Field>
        <FieldLabel>{{ t("settings.mcp.form.command") }}</FieldLabel>
        <TextFieldRoot v-model="draft.command" size="m" class="mono" placeholder="npx" />
      </Field>

      <Field>
        <FieldLabel>{{ t("settings.mcp.form.args") }}</FieldLabel>

        <TextFieldRoot
          v-model="draft.args"
          size="m"
          class="mono"
          :placeholder="t('settings.mcp.form.argsHint')"
        />
      </Field>

      <McpKvRows v-model="draft.env" :label="t('settings.mcp.form.env')" />
    </template>

    <template v-else>
      <Field>
        <FieldLabel>{{ t("settings.mcp.form.url") }}</FieldLabel>
        <TextFieldRoot v-model="draft.url" size="m" class="mono" placeholder="https://" />
      </Field>

      <McpKvRows v-model="draft.headers" :label="t('settings.mcp.form.headers')" />
    </template>

    <Field>
      <FieldLabel>{{ t("settings.mcp.form.description") }}</FieldLabel>
      <TextFieldRoot v-model="draft.description" size="m" />
    </Field>

    <Field class="field-stack">
      <FieldLabel>{{ t("settings.mcp.exposure") }}</FieldLabel>

      <Select v-model="draft.exposure" size="m">
        <SelectTrigger :aria-label="t('settings.mcp.exposure')">{{ draft.exposure }}</SelectTrigger>

        <SelectContent>
          <SelectItem v-for="option in EXPOSURES" :key="option" :value="option">
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>

      <FieldDescription class="form-hint">
        {{ t(`settings.mcp.exposureHint.${draft.exposure}`) }}
      </FieldDescription>
    </Field>

    <Field class="field-inline">
      <FieldLabel>{{ t("settings.mcp.form.enabled") }}</FieldLabel>
      <Switch v-model="draft.enabled" size="s" />
    </Field>

    <Collapsible v-model:open="advanced">
      <CollapsibleTrigger>
        <template #render="{ props: part }">
          <button v-bind="part" type="button" class="fold-trigger">
            <ChevronRightIcon class="fold-chevron" :data-open="advanced ? '' : undefined" />
            {{ t("settings.mcp.form.advanced") }}
          </button>
        </template>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div class="advanced">
          <Field>
            <FieldLabel>{{ t("settings.mcp.form.timeout") }}</FieldLabel>
            <TextFieldRoot v-model="draft.timeout" size="m" inputmode="numeric" />
          </Field>

          <Field v-if="draft.transport === 'stdio'">
            <FieldLabel>{{ t("settings.mcp.form.cwd") }}</FieldLabel>
            <TextFieldRoot v-model="draft.cwd" size="m" class="mono" />
          </Field>

          <template v-else>
            <Field>
              <FieldLabel>{{ t("settings.mcp.form.oauthClientId") }}</FieldLabel>
              <TextFieldRoot v-model="draft.oauthClientId" size="m" class="mono" />
            </Field>

            <Field>
              <FieldLabel>{{ t("settings.mcp.form.oauthClientSecret") }}</FieldLabel>
              <TextFieldRoot v-model="draft.oauthClientSecret" size="m" type="password" />
            </Field>

            <Field>
              <FieldLabel>{{ t("settings.mcp.form.oauthScope") }}</FieldLabel>
              <TextFieldRoot v-model="draft.oauthScope" size="m" class="mono" />
            </Field>

            <Field v-if="scope === 'global'">
              <FieldLabel>{{ t("settings.mcp.form.authProvider") }}</FieldLabel>
              <TextFieldRoot v-model="draft.authProvider" size="m" class="mono" />
            </Field>
          </template>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <Banner v-if="saveError" color="danger" variant="surface" size="s">{{ saveError }}</Banner>

    <div class="form-footer">
      <Button type="button" size="s" variant="outline" @click="emit('cancel')">
        {{ t("common.cancel") }}
      </Button>

      <Button type="submit" size="s" :loading="saving">{{ t("common.save") }}</Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { BracesIcon } from "@lucide/vue"
import type { McpServerView } from "@pig/protocol"

import { ChevronRightIcon } from "@components/icons/index.js"
import McpKvRows from "@features/settings/components/mcp/McpKvRows.vue"
import type { McpState } from "@features/settings/hooks/use-mcp.js"
import { configFromDraft, draftFromConfig, EXPOSURES } from "@features/settings/lib/mcp-draft.js"
import { useI18n } from "@i18n/index.js"
import { Banner } from "@pig/ui/banner"
import { Button } from "@pig/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import { Field, FieldDescription, FieldLabel } from "@pig/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@pig/ui/select"
import { Switch } from "@pig/ui/switch"
import { TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"
import { TextFieldRoot } from "@pig/ui/text-field"

const props = defineProps<{ state: McpState; scope: string; server?: McpServerView | undefined }>()
const emit = defineEmits<{ saved: [name: string]; cancel: []; import: [] }>()
const { t } = useI18n()
const draft = reactive(draftFromConfig(props.server?.name ?? "", props.server?.config ?? {}))
const advanced = ref(false)
const saving = ref(false)
const saveError = ref<string>()
const touched = ref(false)
const nameError = computed(() =>
  touched.value && !/^[\w-]+$/.test(draft.name.trim())
    ? t("settings.mcp.form.nameInvalid")
    : undefined,
)

async function submit() {
  touched.value = true

  if (nameError.value) return
  saving.value = true

  try {
    const name = draft.name.trim()

    saveError.value = await props.state.save(name, configFromDraft(draft, props.server?.config), {
      previousName: props.server?.name,
    })

    if (!saveError.value) emit("saved", name)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.mcp-form,
.advanced {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.advanced {
  padding-block-start: var(--space-sm);
}

.form-top,
.form-footer {
  display: flex;
  gap: var(--space-xs);
}

.form-footer {
  justify-content: flex-end;
}

.mono {
  font-family: var(--font-mono);
}

.form-error,
.form-hint {
  font-size: var(--text-meta);
}

.form-error {
  color: var(--danger-text);
}

.form-hint {
  color: var(--fg-secondary);
}

.field-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2xs);
}

.field-inline {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.fold-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0;
  border: 0;
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  cursor: pointer;
}

.fold-chevron {
  color: var(--fg-muted);
  transition: transform var(--duration-fast) var(--ease-out);
}

.fold-chevron[data-open] {
  transform: rotate(90deg);
}
</style>
