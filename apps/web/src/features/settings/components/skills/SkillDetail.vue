<template>
  <section class="skill-detail">
    <header class="detail-head">
      <div class="detail-top">
        <h2 class="detail-title">
          {{ title }}

          <Badge v-if="broken" size="s" variant="soft" color="warning">
            {{ t("settings.skills.broken") }}
          </Badge>

          <Badge v-if="skill?.disableModelInvocation" size="s" variant="soft" color="neutral">
            {{ t("settings.skills.manualOnly") }}
          </Badge>
        </h2>

        <div class="detail-actions">
          <Button
            v-if="inherited"
            type="button"
            size="s"
            variant="outline"
            @click="emit('jumpGlobal')"
          >
            {{ t("settings.skills.jumpGlobal") }}
          </Button>

          <template v-else>
            <TabsRoot v-model="mode">
              <TabsList variant="segmented" size="s" :aria-label="t('settings.skills.preview')">
                <TabsTrigger value="preview">{{ t("settings.skills.preview") }}</TabsTrigger>
                <TabsTrigger value="edit">{{ t("settings.skills.edit") }}</TabsTrigger>
              </TabsList>
            </TabsRoot>

            <Button
              type="button"
              size="s"
              variant="ghost"
              color="danger"
              @click="confirming = true"
            >
              {{ t("settings.skills.delete") }}
            </Button>
          </template>
        </div>
      </div>

      <p v-if="skill?.description" class="detail-desc">{{ skill.description }}</p>

      <dl class="detail-meta">
        <div class="meta-row">
          <dt class="meta-label">{{ t("settings.skills.path") }}</dt>
          <dd class="meta-value meta-path">{{ path }}</dd>
        </div>

        <div v-if="files.length" class="meta-row">
          <dt class="meta-label">{{ t("settings.skills.files") }}</dt>

          <dd class="meta-value file-chips">
            <button
              v-for="file in files"
              :key="file"
              type="button"
              class="file-chip"
              @click="previewFile = file"
            >
              <FileTextIcon class="size-icon-sm" />
              <span>{{ file }}</span>
            </button>
          </dd>
        </div>
      </dl>
    </header>

    <template v-if="mode === 'edit' && !inherited">
      <Textarea
        v-model="raw"
        size="s"
        class="skill-source"
        spellcheck="false"
        :invalid="Boolean(check.error || invalid)"
        aria-label="SKILL.md"
      />

      <p v-if="check.error" class="source-error">{{ t(errorKey) }}</p>

      <div v-else-if="invalid" class="source-error">
        {{ t("settings.skills.yamlInvalid") }}
        <pre class="source-reason">{{ invalid }}</pre>
      </div>

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

    <SkillAssetDialog
      :state="state"
      :skill-path="path"
      :file="previewFile"
      @close="previewFile = undefined"
    />

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
import { computed, onMounted, ref, watch } from "vue"
import type { SkillView } from "@pig/protocol"

import { FileTextIcon } from "@components/icons/index.js"
import SkillAssetDialog from "@features/settings/components/skills/SkillAssetDialog.vue"
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
import { TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"
import { Textarea } from "@pig/ui/textarea"

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
const previewFile = ref<string>()
const invalid = ref<string>()
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

watch(raw, () => (invalid.value = undefined))

watch(
  () => props.path,
  () => {
    previewFile.value = undefined
  },
)

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
    const reason = await props.state.write(props.path, raw.value)

    invalid.value = reason

    if (reason) return
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
.detail-head {
  display: flex;
  flex-direction: column;
}

.skill-detail {
  gap: var(--space-md);
}

.detail-head {
  gap: var(--space-xs);
}

.detail-top,
.detail-actions,
.detail-footer {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.detail-top {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.detail-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.detail-meta {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: var(--space-xs) var(--space-md);
  margin: 0;
  padding-block: var(--space-xs) var(--space-sm);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.meta-row {
  display: contents;
}

.meta-label {
  padding-block: 2px;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  white-space: nowrap;
}

.meta-value {
  margin: 0;
  min-inline-size: 0;
}

.meta-path,
.file-chip,
.skill-source {
  font-family: var(--font-mono);
}

.meta-path {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  overflow-wrap: anywhere;
}

.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
  max-block-size: 7.5rem;
  overflow-y: auto;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  max-inline-size: 100%;
  padding: 2px var(--space-xs);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  background-clip: padding-box;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.file-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.file-chip:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

.detail-footer {
  justify-content: flex-end;
}

.skill-source {
  min-height: 22rem;
  line-height: 1.5;
}

.source-error,
.source-warning {
  margin: 0;
  font-size: var(--text-meta);
}

.source-error {
  color: var(--danger-text);
}

.source-reason {
  margin: var(--space-2xs) 0 0;
  font-family: var(--font-mono);
  white-space: pre-wrap;
}

.source-warning {
  color: var(--warning-text);
}

.skill-preview {
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  background-clip: padding-box;
}
</style>
