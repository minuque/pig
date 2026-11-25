<template>
  <Toolbar class="scope-toolbar" :aria-label="label">
    <label class="scope-search">
      <SearchIcon class="size-icon" />

      <ToolbarInput
        :value="query"
        class="scope-input"
        :placeholder="t('settings.scope.search')"
        :aria-label="t('settings.scope.search')"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <DropdownMenu v-if="workspace" :modal="false">
      <ToolbarButton>
        <template #render="{ props: part }">
          <DropdownMenuTrigger v-bind="part">
            <template #render="{ props: trigger }">
              <Button
                v-bind="trigger"
                type="button"
                size="m"
                variant="ghost"
                class="scope-trigger"
                :data-filtered="scope !== 'global' ? '' : undefined"
                :aria-label="t('settings.scope.label')"
              >
                <FunnelIcon class="size-icon" />
                {{ scope === "global" ? t("settings.scope.global") : workspaceName }}
              </Button>
            </template>
          </DropdownMenuTrigger>
        </template>
      </ToolbarButton>

      <DropdownMenuContent align="end" :side-offset="6">
        <DropdownMenuRadioGroup
          :model-value="scope"
          @update:model-value="emit('update:scope', String($event))"
        >
          <DropdownMenuRadioItem value="global" close-on-select>
            {{ t("settings.scope.global") }}
          </DropdownMenuRadioItem>

          <DropdownMenuRadioItem :value="workspace" :title="workspace" close-on-select>
            {{ workspaceName }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <ToolbarSeparator class="scope-separator" />

    <ToolbarButton @click="emit('add')">
      <template #render="{ props: part }">
        <Button v-bind="part" type="button" size="m" variant="ghost">
          <PlusIcon class="size-icon" />
          {{ addLabel }}
        </Button>
      </template>
    </ToolbarButton>
  </Toolbar>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { FunnelIcon } from "@lucide/vue"
import { PlusIcon, SearchIcon } from "@components/icons/index.js"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@pig/ui/dropdown-menu"
import { Toolbar, ToolbarButton, ToolbarInput, ToolbarSeparator } from "@pig/ui/toolbar"

const props = defineProps<{
  label: string
  addLabel: string
  scope: string
  workspace: string | undefined
  query: string
}>()
const emit = defineEmits<{
  "update:scope": [scope: string]
  "update:query": [query: string]
  add: []
}>()
const { t } = useI18n()
const workspaceName = computed(() => props.workspace?.split(/[\\/]/).filter(Boolean).pop() ?? "")
</script>

<style scoped>
.scope-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  padding: var(--space-2xs);
  border-radius: var(--radius-control);
  background-color: var(--control-bg);
  box-shadow: var(--control-shadow);
}

.scope-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding-inline: var(--space-sm);
  color: var(--fg-muted);
}

.scope-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: var(--text-body);
}

.scope-input::placeholder {
  color: var(--fg-muted);
}

.scope-trigger {
  color: var(--fg-secondary);
}

.scope-trigger[data-filtered] {
  background-color: var(--bg-selected);
  color: var(--fg);
}

.scope-separator {
  flex: none;
  align-self: stretch;
  inline-size: var(--border-width);
  margin-block: var(--space-2xs);
  background-color: var(--border-subtle);
}
</style>
