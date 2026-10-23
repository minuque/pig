<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="search-dialog" :show-close-button="false" @open-auto-focus="onOpenFocus">
      <DialogTitle class="sr-only">{{ t("nav.search") }}</DialogTitle>

      <label class="search-bar">
        <span class="search-lead"><MagnifierIcon :size="15" /></span>

        <input
          ref="inputEl"
          v-model="query"
          type="text"
          class="search-input"
          :placeholder="t('nav.searchPlaceholder')"
          :aria-label="t('nav.searchPlaceholder')"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="activate(activeIndex)"
          @keydown.esc.prevent="emit('update:open', false)"
        />

        <button
          class="search-close"
          type="button"
          :aria-label="t('common.close')"
          @click="emit('update:open', false)"
        >
          <CloseIcon :size="14" />
        </button>
      </label>

      <div class="search-results" role="listbox" :aria-label="t('nav.search')">
        <div v-if="!rows.length" class="search-empty">{{ t("nav.searchEmpty") }}</div>

        <button
          v-for="(row, index) in rows"
          :key="row.id"
          class="search-row"
          :class="{ active: index === activeIndex }"
          type="button"
          role="option"
          :aria-selected="index === activeIndex"
          @pointerenter="activeIndex = index"
          @click="activate(index)"
        >
          <span class="row-icon" aria-hidden="true"><CodeSquareIcon :size="15" /></span>
          <span class="row-title">{{ row.title }}</span>

          <span v-if="index === activeIndex" class="row-go" aria-hidden="true">
            <ArrowLeftDownIcon :size="13" />
          </span>

          <span v-else class="row-time">{{ row.time }}</span>
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { useNav } from "@features/session-nav/index.js"
import {
  filterSessionsForSearch,
  sortSessionsForSidebar,
} from "@features/session-nav/lib/session-list.js"
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import {
  ArrowLeftDownIcon,
  CloseIcon,
  CodeSquareIcon,
  MagnifierIcon,
} from "@components/icons/index.js"

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const { t } = useI18n()
const { listedSessions, sort, openSession } = useNav()
const query = shallowRef("")
const activeIndex = shallowRef(0)
const inputEl = useTemplateRef("inputEl")
const rows = computed(() => {
  const filtered = filterSessionsForSearch(listedSessions.value, query.value)
  return sortSessionsForSidebar(filtered, sort.value)
    .slice(0, 50)
    .map((session) => ({
      id: session.id,
      title: session.sessionName?.trim() || t("session.untitled"),
      time: formatRelativeTime(session.updatedAt ?? session.createdAt),
    }))
})

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      query.value = ""
      activeIndex.value = 0
      return
    }

    await nextTick()
    inputEl.value?.focus()
    inputEl.value?.select()
  },
)

watch(query, () => {
  activeIndex.value = 0
})

function onOpenFocus(event: Event) {
  event.preventDefault()
  inputEl.value?.focus()
}

function clearQuery() {
  query.value = ""
  inputEl.value?.focus()
}

/** 结果行滚到可见。 */
function scrollActiveIntoView() {
  nextTick(() => {
    document
      .querySelector<HTMLElement>(".search-results .search-row.active")
      ?.scrollIntoView({ block: "nearest" })
  })
}

function move(delta: number) {
  const count = rows.value.length

  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
  scrollActiveIntoView()
}

function activate(index: number) {
  const row = rows.value[index]

  if (!row) return
  emit("update:open", false)
  openSession(row.id)
}
</script>

<style>
/* 不写 scoped：DialogContent 经 Portal 到 body，scoped attribute 打不中。
   覆盖全局 translate(-50%,-50%) 的 Y 位移：只水平居中，顶边锚到 1/6 视口高度。 */
.search-dialog {
  gap: 0;
  width: min(560px, calc(100vw - var(--spacing-lg) * 2));
  max-width: 560px;
  max-height: min(70dvh, 640px);
  padding: 0;
  top: 16dvh;
  transform: translateX(-50%);
}

/* 顶部搜索条：与列表用 hairline 分隔，不画外框。 */
.search-bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: 52px;
  padding-inline: var(--spacing-md);
  border-bottom: var(--border-width) solid var(--hairline);
}

.search-lead {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--contrast-foreground);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-body-md);
}

.search-input::placeholder {
  color: var(--contrast-foreground-faint);
}

.search-close {
  display: grid;
  flex: none;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
}

.search-close:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  min-height: 0;
  max-height: min(60dvh, 540px);
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--spacing-xs);
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.search-empty {
  padding: var(--spacing-md);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-caption);
  text-align: center;
}

.search-row {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  min-width: 0;
  height: 36px;
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  text-align: start;
  cursor: default;
  transition: background-color var(--duration-fast) var(--ease-hover);
}

.search-row.active {
  background: var(--glass-selected-bg);
  color: var(--contrast-foreground);
}

.row-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--contrast-foreground);
}

.search-row.active .row-icon {
  color: var(--contrast-foreground);
}

.row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-time {
  flex: none;
  margin-inline-start: auto;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
}

.row-go {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
  margin-inline-start: auto;
  color: var(--contrast-foreground);
}
</style>
