<template>
  <span
    class="view-island"
    data-island
    :data-expanded="expanded || undefined"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <TabsRoot :model-value="current" @update:model-value="show">
      <TabsList variant="segmented" size="s" :aria-label="t('views.label')">
        <TabsTrigger
          v-for="view in PANE_VIEWS"
          :key="view"
          :value="view"
          class="island-tab"
          :data-current="view === current || undefined"
        >
          {{ t(`views.${view}`) }}
        </TabsTrigger>

        <span class="island-position" aria-hidden="true">
          {{
            t("views.position", {
              index: PANE_VIEWS.indexOf(current) + 1,
              total: PANE_VIEWS.length,
            })
          }}
        </span>
      </TabsList>
    </TabsRoot>
  </span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"
import { PANE_VIEWS, usePaneSide, useSplitView, type PaneView } from "@features/split-view/index.js"

const PEEK_MS = 1200
const { t } = useI18n()
const side = usePaneSide()
const split = useSplitView()
const current = computed(() => split.view(side))
const hovered = shallowRef(false)
const peeking = shallowRef(false)
const expanded = computed(() => hovered.value || peeking.value)
let timer: ReturnType<typeof setTimeout> | undefined

watch(current, () => {
  clearTimeout(timer)
  peeking.value = true
  timer = setTimeout(() => (peeking.value = false), PEEK_MS)
})

onBeforeUnmount(() => clearTimeout(timer))

function show(view: string) {
  const next = PANE_VIEWS.find((item) => item === view)

  if (next) split.showView(side, next satisfies PaneView)
}
</script>

<style scoped>
.view-island {
  display: inline-flex;
  justify-self: center;
}

.island-tab:not([data-current]) {
  max-inline-size: 0;
  padding-inline: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    max-inline-size var(--duration-normal) var(--ease-spring),
    padding var(--duration-normal) var(--ease-spring),
    opacity var(--duration-fast) var(--ease-out);
}

.view-island:is([data-expanded], :focus-within) .island-tab:not([data-current]) {
  max-inline-size: 8em;
  padding-inline: var(--space-xs);
  opacity: 1;
}

.island-position {
  display: flex;
  align-items: center;
  padding-inline: var(--space-2xs) var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.view-island:is([data-expanded], :focus-within) .island-position {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .island-tab:not([data-current]) {
    transition: none;
  }
}
</style>
