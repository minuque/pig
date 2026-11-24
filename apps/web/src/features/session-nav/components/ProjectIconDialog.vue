<template>
  <Dialog :open="path !== undefined" @update:open="!$event && emit('close')">
    <DialogContent class="project-icon-dialog">
      <DialogTitle>{{ t("session.projectIcon") }}</DialogTitle>
      <DialogDescription>{{ path ? workspaceName(path) : "" }}</DialogDescription>

      <ToggleGroup
        class="icon-colors"
        :aria-label="t('session.iconColor')"
        :value="[draft.color]"
        :deselectable="false"
        @value-change="(next: string[]) => pickColor(next[0])"
      >
        <Toggle v-for="color in PROJECT_ICON_COLORS" :key="color" :value="color">
          <template #render="{ props: part, state }">
            <IconButton
              v-bind="part"
              size="s"
              :variant="state.pressed ? 'secondary' : 'ghost'"
              :color="projectIconTone(color)"
              :aria-label="color"
            >
              <span class="swatch" :data-tone="projectIconTone(color)" />
            </IconButton>
          </template>
        </Toggle>
      </ToggleGroup>

      <ToggleGroup
        class="icon-grid"
        :aria-label="t('session.projectIcon')"
        :value="current ? [current.name] : []"
        :deselectable="false"
        @value-change="(next: string[]) => pickName(next[0])"
      >
        <Toggle v-for="(icon, name) in PROJECT_ICONS" :key="name" :value="name">
          <template #render="{ props: part, state }">
            <IconButton
              v-bind="part"
              size="m"
              :variant="state.pressed ? 'secondary' : 'ghost'"
              :color="projectIconTone(draft.color)"
              :aria-label="name"
            >
              <component :is="icon" class="size-icon-lg" />
            </IconButton>
          </template>
        </Toggle>
      </ToggleGroup>

      <div class="icon-actions">
        <Button
          variant="secondary"
          color="neutral"
          type="button"
          :disabled="!current"
          @click="reset"
        >
          {{ t("session.resetIcon") }}
        </Button>

        <DialogClose>
          <template #render="{ props: part }">
            <Button v-bind="part" type="button">{{ t("common.close") }}</Button>
          </template>
        </DialogClose>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@pig/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@pig/ui/dialog"
import { Toggle, ToggleGroup } from "@pig/ui/toggle"
import { PROJECT_ICONS } from "@components/icons/project-icons.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import {
  PROJECT_ICON_COLORS,
  projectIconTone,
  type ProjectIconChoice,
} from "@features/session-nav/lib/project-prefs.js"
import { useProjectPrefs } from "@features/session-nav/hooks/use-project-prefs.js"

const props = defineProps<{ path: string | undefined }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const { iconOf, setIcon } = useProjectPrefs()
const current = computed(() => iconOf(props.path))
const draft = computed<ProjectIconChoice>(() => current.value ?? { name: "folder", color: "gray" })

function pick(choice: ProjectIconChoice): void {
  if (props.path) setIcon(props.path, choice)
}

function pickColor(color: string | undefined): void {
  const next = PROJECT_ICON_COLORS.find((item) => item === color)

  if (next) pick({ ...draft.value, color: next })
}

function pickName(name: string | undefined): void {
  if (name && name in PROJECT_ICONS) pick({ ...draft.value, name })
}

function reset(): void {
  if (props.path) setIcon(props.path, undefined)
}
</script>

<style>
.project-icon-dialog[data-slot="dialog-content"] {
  max-inline-size: var(--dialog-width-sm);
}

.project-icon-dialog .icon-colors {
  display: flex;
  gap: var(--space-2xs);
  margin-block: var(--space-md) var(--space-sm);
}

.project-icon-dialog .swatch {
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  border-radius: var(--radius-pill);
  background-color: var(--tint);
}

.project-icon-dialog .icon-grid {
  display: grid;
  grid-template-columns: repeat(10, var(--control-sm));
  justify-content: space-between;
  row-gap: var(--space-2xs);
}

.project-icon-dialog .icon-actions {
  display: flex;
  justify-content: space-between;
  margin-block-start: var(--space-md);
}
</style>
