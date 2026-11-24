<template>
  <PopoverContent
    side="bottom"
    align="start"
    :side-offset="4"
    :initial-focus="() => searchRef"
    data-menu-content
    class="scope-menu"
  >
    <div data-menu-viewport>
      <div class="scope-search">
        <SearchIcon class="search-icon" />

        <input
          ref="searchRef"
          v-model="query"
          type="text"
          :placeholder="t('session.searchProjects')"
          :aria-label="t('session.searchProjects')"
          @keydown.down.prevent="focusFirstToggle"
        />
      </div>

      <ToggleGroup
        ref="projectsRef"
        class="scope-projects"
        multiple
        orientation="vertical"
        :aria-label="t('session.filterByWorkspace')"
        :value="selected"
        @value-change="onSelect"
      >
        <div v-if="!needle" class="scope-item" data-menu-item>
          <Toggle :value="ALL_PROJECTS">
            <template #render="{ props: part, state }">
              <button v-bind="part" type="button" class="scope-toggle">
                <span class="scope-icon">
                  <FolderIcon class="size-icon-lg" />
                  <span v-if="state.pressed" class="check-badge"><CheckIcon /></span>
                </span>

                <span class="scope-name">{{ t("session.allProjects") }}</span>
              </button>
            </template>
          </Toggle>
        </div>

        <div
          v-for="group in matched"
          :key="group.canonicalPath"
          class="scope-item scope-row"
          data-menu-item
        >
          <Toggle :value="group.canonicalPath">
            <template #render="{ props: part, state }">
              <button v-bind="part" type="button" class="scope-toggle">
                <span class="scope-icon">
                  <ProjectIcon :path="group.canonicalPath" class="size-icon-lg" />

                  <span v-if="state.pressed" class="check-badge">
                    <CheckIcon />
                  </span>
                </span>

                <span class="scope-name">{{ workspaceName(group.canonicalPath) }}</span>
              </button>
            </template>
          </Toggle>

          <span class="scope-actions">
            <Tooltip>
              <TooltipTrigger>
                <template #render="{ props: part }">
                  <IconButton
                    v-bind="part"
                    class="row-action"
                    type="button"
                    size="m"
                    variant="ghost"
                    color="neutral"
                    tabindex="-1"
                    :aria-label="t('session.projectIcon')"
                    @click="emit('settings', group.canonicalPath)"
                  >
                    <SettingsIcon />
                  </IconButton>
                </template>
              </TooltipTrigger>

              <TooltipContent>{{ t("session.projectIcon") }}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <template #render="{ props: part }">
                  <IconButton
                    v-bind="part"
                    class="row-action"
                    :data-pinned="isPinned(group.canonicalPath) || undefined"
                    type="button"
                    size="m"
                    variant="ghost"
                    color="neutral"
                    tabindex="-1"
                    :aria-label="pinLabel(group.canonicalPath)"
                    @click="togglePinned(group.canonicalPath)"
                  >
                    <PinIcon />
                  </IconButton>
                </template>
              </TooltipTrigger>

              <TooltipContent>{{ pinLabel(group.canonicalPath) }}</TooltipContent>
            </Tooltip>
          </span>
        </div>

        <p v-if="!matched.length" class="scope-empty">{{ t("session.noMatchingProjects") }}</p>
      </ToggleGroup>
    </div>
  </PopoverContent>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { workspaceName } from "@features/session-nav/index.js"
import { IconButton } from "@pig/ui/button"
import { PopoverContent } from "@pig/ui/popover"
import { Toggle, ToggleGroup } from "@pig/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import {
  CheckIcon,
  FolderIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
} from "@components/icons/index.js"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import { useProjectPrefs } from "@features/session-nav/hooks/use-project-prefs.js"
import { orderPinnedFirst } from "@features/session-nav/lib/project-prefs.js"
import type { SessionGroup } from "@features/session-nav/type.js"

const ALL_PROJECTS = "all-projects"
const props = defineProps<{
  open: boolean
  groups: readonly SessionGroup[]
  scopeFilter: ReadonlySet<string>
}>()
const emit = defineEmits<{
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
  settings: [canonicalPath: string]
}>()
const { t } = useI18n()
const query = shallowRef("")
const searchRef = useTemplateRef<HTMLInputElement>("searchRef")
const projectsRef = useTemplateRef<{ $el: HTMLElement }>("projectsRef")
const { prefs, isPinned, togglePinned } = useProjectPrefs()
const needle = computed(() => query.value.trim().toLowerCase())
const selected = computed(() => (props.scopeFilter.size ? [...props.scopeFilter] : [ALL_PROJECTS]))
const matched = computed(() =>
  orderPinnedFirst(props.groups, prefs.value.pinned).filter((group) =>
    workspaceName(group.canonicalPath).toLowerCase().includes(needle.value),
  ),
)

function pinLabel(canonicalPath: string): string {
  const name = workspaceName(canonicalPath)
  return isPinned(canonicalPath)
    ? t("session.unpinProject", { name })
    : t("session.pinProject", { name })
}

watch(
  () => props.open,
  (open) => {
    if (open) query.value = ""
  },
)

function focusFirstToggle(): void {
  projectsRef.value?.$el.querySelector<HTMLElement>(".scope-toggle")?.focus()
}

function onSelect(next: string[]): void {
  const cleared = next.includes(ALL_PROJECTS) && props.scopeFilter.size > 0
  emit("update:scopeFilter", new Set(cleared ? [] : next.filter((path) => path !== ALL_PROJECTS)))
}
</script>

<style scoped>
:global(.scope-menu) {
  padding: 0;
}

.scope-search {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--control-md);
  margin-block-end: var(--space-2xs);
  padding-inline: var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.search-icon {
  color: var(--fg-secondary);
}

.scope-search input {
  flex: 1;
  min-inline-size: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font: inherit;
}

.scope-search input::placeholder {
  color: var(--fg-secondary);
}

.scope-empty {
  padding: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.scope-projects {
  display: flex;
  flex-direction: column;
  max-block-size: calc((var(--control-md) + var(--menu-item-gap)) * 9);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.scope-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-item {
  flex: none;
}

.scope-item:is(:hover, :focus-within) {
  background-color: var(--bg-hover);
}

.scope-item:has([aria-pressed="true"]):is(:hover, :focus-within) {
  background-color: var(--bg-selected);
}

.scope-toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  align-self: stretch;
  min-inline-size: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.scope-icon {
  position: relative;
  display: flex;
  flex: none;
}

.check-badge {
  position: absolute;
  inset-block-end: calc(var(--space-2xs) * -1);
  inset-inline-end: calc(var(--space-2xs) * -1);
  display: grid;
  place-items: center;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  border-radius: var(--radius-pill);
  background-color: var(--accent-solid);
  box-shadow: 0 0 0 calc(var(--border-width) * 2) var(--bg-raised);
  color: var(--fg-on-accent);
}

.check-badge .lucide {
  inline-size: calc(var(--icon-sm) - var(--space-2xs));
  block-size: calc(var(--icon-sm) - var(--space-2xs));
  stroke-width: calc(var(--icon-stroke) * 2);
}

.scope-actions {
  display: flex;
  margin-inline-start: auto;
  padding-inline-start: var(--space-xs);
}

.row-action:not([data-pinned]) {
  visibility: hidden;
}

.scope-row:is(:hover, :focus-within) .row-action {
  visibility: visible;
}
</style>
