<template>
  <section class="pane">
    <SkillCreate
      v-if="view === 'create'"
      :state="state"
      @created="(path) => open(path, true)"
      @cancel="back"
    />

    <SkillDetail
      v-else-if="view === 'detail' && selected"
      :key="selected"
      :state="state"
      :path="selected"
      :name="issue?.name ?? ''"
      :skill="skill"
      :broken="Boolean(issue)"
      :inherited="isInherited"
      :start-in-edit="startInEdit"
      @removed="back"
      @jump-global="jumpGlobal"
    />

    <SkillList
      v-else
      :state="state"
      :scope="scope"
      :workspace="workspace"
      @update:scope="scope = $event"
      @open="(path) => open(path, false)"
      @fix="(path) => open(path, true)"
      @add="view = 'create'"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from "vue"

import SkillCreate from "@features/settings/components/skills/SkillCreate.vue"
import SkillDetail from "@features/settings/components/skills/SkillDetail.vue"
import SkillList from "@features/settings/components/skills/SkillList.vue"
import { SETTINGS_TRAIL, type SettingsCrumb } from "@features/settings/hooks/use-settings-dialog.js"
import { useSkills } from "@features/settings/hooks/use-skills.js"
import { useI18n } from "@i18n/index.js"

defineProps<{ workspace: string | undefined }>()

const { t } = useI18n()
const trail = inject(SETTINGS_TRAIL)
const scope = ref("global")
const state = useSkills(scope)
const view = ref<"list" | "detail" | "create">("list")
const selected = ref<string>()
const startInEdit = ref(false)
const skill = computed(() =>
  [...(state.view.value?.skills ?? []), ...(state.view.value?.inherited ?? [])].find(
    (item) => item.filePath === selected.value,
  ),
)
const issue = computed(() =>
  skill.value ? undefined : state.view.value?.diagnostics.find((d) => d.path === selected.value),
)
const isInherited = computed(
  () => !!state.view.value?.inherited.some((item) => item.filePath === selected.value),
)

function back() {
  view.value = "list"
  selected.value = undefined
}

function open(path: string, edit: boolean) {
  selected.value = path
  startInEdit.value = edit
  view.value = "detail"
}

async function jumpGlobal() {
  const path = selected.value

  scope.value = "global"
  await state.refresh()

  if (path) open(path, false)
}

const crumbs = computed<SettingsCrumb[]>(() => {
  if (view.value === "list") return [{ label: t("settings.skills.title") }]
  const root = { label: t("settings.skills.title"), action: back }

  if (view.value === "create") return [root, { label: t("settings.skills.newSkill") }]
  return [root, { label: skill.value?.name ?? issue.value?.name ?? "SKILL.md" }]
})

watch(
  crumbs,
  (value) => {
    if (trail) trail.value = value
  },
  { immediate: true },
)

watch(scope, () => {
  if (view.value !== "detail") back()
})

onUnmounted(() => {
  if (trail) trail.value = []
})
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  padding-block-end: var(--space-md);
}
</style>
