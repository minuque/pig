<template>
  <section class="skill-detail">
    <header class="detail-head">
      <h2 class="detail-title">
        {{ title }}

        <Badge v-if="broken" size="s" variant="soft" color="warning">
          {{ t("settings.skills.broken") }}
        </Badge>

        <Badge v-if="skill?.disableModelInvocation" size="s" variant="soft" color="neutral">
          {{ t("settings.skills.manualOnly") }}
        </Badge>
      </h2>

      <p v-if="skill?.description" class="detail-desc">{{ skill.description }}</p>
      <p class="detail-desc detail-mono">{{ path }}</p>
    </header>

    <div class="detail-bar">
      <Button v-if="inherited" type="button" size="s" variant="outline" @click="emit('jumpGlobal')">
        {{ t("settings.skills.jumpGlobal") }}
      </Button>

      <template v-else>
        <TabsRoot v-model="mode">
          <TabsList variant="segmented" size="s" :aria-label="t('settings.skills.preview')">
            <TabsTrigger value="preview">{{ t("settings.skills.preview") }}</TabsTrigger>
            <TabsTrigger value="edit">{{ t("settings.skills.edit") }}</TabsTrigger>
          </TabsList>
        </TabsRoot>

        <Button type="button" size="s" variant="ghost" color="danger" @click="confirming = true">
          {{ t("settings.skills.delete") }}
        </Button>
      </template>
    </div>

    <template v-if="mode === 'edit' && !inherited">
      <textarea v-model="raw" class="skill-source" spellcheck="false" aria-label="SKILL.md" />
      <p v-if="check.error" class="source-error">{{ t(errorKey) }}</p>
      <p v-else-if="check.warning" class="source-warning">{{ t("settings.skills.nameWarning") }}</p>

      <div class="detail-footer">
        <Button type="button" size="s" variant="outline" :disabled="!dirty" @click="raw = saved">
          {{ t("settings.skills.discard") }}
        </Button>

        <Button
          type="button"
          size="s"
          :disabled="!dirty || Boolean(check.error)"
          :loading="saving"
          @click="save"
        >
          {{ t("common.save") }}
        </Button>
      </div>
    </template>

    <div v-else class="skill-preview">
      <MarkdownContent :nodes="nodes" />
    </div>

    <section v-if="files.length" class="detail-section">
      <h3 class="section-title">{{ t("settings.skills.files") }}</h3>

      <CardList>
        <CardRow v-for="file in files" :key="file" class="file-row">{{ file }}</CardRow>
      </CardList>
    </section>

    <AlertDialog v-model:open="confirming">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ t("settings.skills.deleteTitle", { name: title }) }}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {{ t("settings.skills.deleteBody", { dir }) }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>

          <AlertDialogAction color="danger" @click="remove">
            {{ standard ? t("settings.skills.delete") : t("settings.skills.deleteForce") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type { SkillView } from "@pig/protocol"

import type { SkillsState } from "@features/settings/hooks/use-skills.js"
import { checkSkillSource, deleteTarget, skillBody } from "@features/settings/lib/skill-source.js"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import { useI18n } from "@i18n/index.js"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@pig/ui/alert-dialog"
import { Badge } from "@pig/ui/badge"
import { Button } from "@pig/ui/button"
import { CardList, CardRow } from "@pig/ui/card"
import { TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"

const props = defineProps<{
  state: SkillsState
  path: string
  name: string
  skill: SkillView | undefined
  broken: boolean
  inherited: boolean
  startInEdit: boolean
}>()
const emit = defineEmits<{ removed: []; jumpGlobal: [] }>()
const { t } = useI18n()
const mode = ref<"preview" | "edit">(props.startInEdit ? "edit" : "preview")
const raw = ref("")
const saved = ref("")
const files = ref<string[]>([])
const saving = ref(false)
const confirming = ref(false)
const title = computed(() => props.skill?.name ?? props.name)
const dirty = computed(() => raw.value !== saved.value)
const check = computed(() => checkSkillSource(raw.value))
const errorKey = computed(() =>
  check.value.error === "frontmatter"
    ? "settings.skills.frontmatterMissing"
    : "settings.skills.descriptionMissing",
)
const target = computed(() => deleteTarget(props.path, props.state.view.value?.roots ?? []))
const dir = computed(() => target.value.path)
const standard = computed(() => target.value.standard)
const nodes = useMarkdownNodes({
  text: () => skillBody(raw.value),
  streaming: () => false,
  cacheKey: () => `skill:${props.path}:${raw.value.length}`,
})

onMounted(async () => {
  const file = await props.state.read(props.path)

  raw.value = file.raw
  saved.value = file.raw
  files.value = file.files
})

async function save() {
  saving.value = true

  try {
    await props.state.write(props.path, raw.value)
    saved.value = raw.value
    mode.value = "preview"
  } catch {
    return
  } finally {
    saving.value = false
  }
}

async function remove() {
  await props.state.remove(props.path).then(
    () => emit("removed"),
    () => undefined,
  )
}

defineExpose({ dirty })
</script>

<style scoped>
.skill-detail,
.detail-head,
.detail-section {
  display: flex;
  flex-direction: column;
}

.skill-detail {
  gap: var(--space-md);
}

.detail-head,
.detail-section {
  gap: var(--space-2xs);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  color: var(--fg);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
}

.detail-desc {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.detail-mono,
.file-row,
.skill-source {
  font-family: var(--font-mono);
}

.detail-bar,
.detail-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
}

.detail-footer {
  justify-content: flex-end;
}

.skill-source {
  box-sizing: border-box;
  width: 100%;
  min-height: 22rem;
  padding: var(--space-sm);
  border: var(--border-width) solid var(--border-input);
  border-radius: var(--radius-control);
  background: var(--control-bg);
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: 1.5;
  resize: vertical;
}

.skill-source:focus {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

.source-error,
.source-warning {
  margin: 0;
  font-size: var(--text-meta);
}

.source-error {
  color: var(--danger-text);
}

.source-warning {
  color: var(--warning-text);
}

.skill-preview {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
}

.section-title {
  margin: 0;
  padding-inline: var(--space-md);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
}

.file-row {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}
</style>
