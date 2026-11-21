<template>
  <TabsRoot
    class="file-tabs"
    :model-value="state.active ?? ''"
    activation-mode="manual"
    @update:model-value="(path: string | number) => pane.activate(String(path))"
  >
    <TabsList ref="list" class="file-tabs-list" :aria-label="t('files.title')">
      <div
        v-for="tab in state.tabs"
        :key="tab.path"
        class="file-tab"
        :data-selected="tab.path === state.active || undefined"
        :data-preview="tab.preview || undefined"
        :title="tab.path"
        @dblclick="pane.pin(tab.path)"
        @auxclick.middle="pane.close(tab.path)"
      >
        <TabsTrigger :value="tab.path" class="file-tab-trigger">
          <span class="file-tab-label">{{ pathBasename(tab.path) }}</span>
        </TabsTrigger>

        <button
          type="button"
          class="file-tab-close"
          :aria-label="t('files.closeTab')"
          @click="pane.close(tab.path)"
        >
          <XIcon class="size-icon-sm" />
        </button>
      </div>
    </TabsList>

    <DropdownMenu v-if="overflowing" :modal="false">
      <DropdownMenuTrigger as-child>
        <IconButton
          type="button"
          size="s"
          variant="ghost"
          color="neutral"
          :aria-label="t('files.allTabs')"
        >
          <ChevronDownIcon class="size-icon" />
        </IconButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          v-for="tab in state.tabs"
          :key="tab.path"
          :class="{ 'is-preview': tab.preview }"
          @select="pane.activate(tab.path)"
        >
          {{ pathBasename(tab.path) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TabsRoot>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { TabsList, TabsRoot, TabsTrigger } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { ChevronDownIcon, XIcon } from "@components/icons/index.js"
import { pathBasename } from "@features/transcript-view/lib/tool-summary.js"
import { useFilePane } from "@features/file-pane/index.js"

const { t } = useI18n()
const pane = useFilePane()
const state = computed(() => pane.tabs.value)
const list = useTemplateRef<{ $el: HTMLElement }>("list")
const overflowing = shallowRef(false)

function measure() {
  const el = list.value?.$el
  overflowing.value = Boolean(el && el.scrollWidth > el.clientWidth)
}

useResizeObserver(() => list.value?.$el, measure)

watch(
  () => [state.value.active, state.value.tabs.length],
  async () => {
    await nextTick()
    measure()
    list.value?.$el
      .querySelector<HTMLElement>(".file-tab[data-selected]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  },
)
</script>

<style scoped>
.file-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-inline-size: 0;
}

.file-tabs-list {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2xs);
  min-inline-size: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.file-tab {
  position: relative;
  display: flex;
  flex: 0 1 192px;
  align-items: center;
  gap: var(--space-2xs);
  min-inline-size: 104px;
  max-inline-size: max-content;
  block-size: 24px;
  padding: 2px;
  border-radius: var(--radius-control);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  user-select: none;
}

.file-tab:hover {
  background: var(--bg-hover);
}

.file-tab[data-selected] {
  background: var(--bg-selected);
  color: var(--fg);
}

.file-tab:has(:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

.file-tab-trigger {
  display: flex;
  flex: 1;
  align-items: center;
  min-inline-size: 0;
  block-size: 100%;
  padding: 0 0 0 var(--space-2xs);
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  outline: none;
}

.file-tab-trigger::before {
  content: "";
  position: absolute;
  inset: 0;
}

.file-tab-label {
  overflow: hidden;
  max-inline-size: 140px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-tab[data-preview] .file-tab-label,
.is-preview {
  font-style: italic;
}

.file-tab-close {
  position: relative;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: 20px;
  block-size: 20px;
  padding: 0;
  border: 0;
  border-radius: calc(var(--radius-control) - 2px);
  background: none;
  color: var(--fg-secondary);
}

.file-tab-close:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.file-tab[data-selected] .file-tab-close {
  color: var(--fg);
}
</style>
