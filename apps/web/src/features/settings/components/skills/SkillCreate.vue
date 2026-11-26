<template>
  <form class="skill-create" @submit.prevent="submit">
    <Field :invalid="Boolean(nameError)">
      <FieldLabel>{{ t("settings.skills.name") }}</FieldLabel>

      <TextFieldRoot
        v-model="name"
        size="m"
        class="mono"
        placeholder="my-skill"
        :invalid="Boolean(nameError)"
      />

      <FieldError v-if="nameError" match>{{ nameError }}</FieldError>
    </Field>

    <Field>
      <FieldLabel>{{ t("settings.skills.whenToUse") }}</FieldLabel>

      <Textarea
        v-model="description"
        size="m"
        rows="3"
        auto-resize
        class="when-input"
        :placeholder="t('settings.skills.whenHint')"
      />
    </Field>

    <p class="form-note">{{ t("settings.skills.writeTo", { path: target }) }}</p>

    <Banner v-if="createError" color="danger" variant="surface" size="s">
      {{ createError }}
    </Banner>

    <div class="form-footer">
      <Button type="button" size="s" variant="outline" @click="emit('cancel')">
        {{ t("common.cancel") }}
      </Button>

      <Button type="submit" size="s" :disabled="!description.trim()" :loading="busy">
        {{ t("settings.skills.create") }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"

import type { SkillsState } from "@features/settings/hooks/use-skills.js"
import { isValidSkillName } from "@features/settings/lib/skill-source.js"
import { useI18n } from "@i18n/index.js"
import { Banner } from "@pig/ui/banner"
import { Button } from "@pig/ui/button"
import { Field, FieldError, FieldLabel } from "@pig/ui/field"
import { TextFieldRoot } from "@pig/ui/text-field"
import { Textarea } from "@pig/ui/textarea"

const props = defineProps<{ state: SkillsState }>()
const emit = defineEmits<{ created: [path: string]; cancel: [] }>()
const { t } = useI18n()
const name = ref("")
const description = ref("")
const busy = ref(false)
const createError = ref<string>()
const nameError = computed(() =>
  name.value && !isValidSkillName(name.value) ? t("settings.skills.nameInvalid") : undefined,
)
const target = computed(() => {
  const root = props.state.view.value?.roots[0] ?? ""
  const sep = root.includes("\\") ? "\\" : "/"
  return [root, name.value || "<name>", "SKILL.md"].join(sep)
})

async function submit() {
  if (!name.value || nameError.value) return
  busy.value = true

  try {
    const result = await props.state.create(name.value, description.value.trim())

    if ("error" in result) createError.value = result.error
    else emit("created", result.filePath)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.skill-create {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.mono,
.form-note {
  font-family: var(--font-mono);
}

.when-input {
  max-block-size: 10rem;
}

.form-note {
  margin: 0;
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
}
</style>
