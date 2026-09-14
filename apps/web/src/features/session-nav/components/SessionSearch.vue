<template>
  <Dialog :open="open" @update:open="open = $event">
    <DialogContent
      class="gap-0 overflow-hidden !p-0 sm:max-w-[min(36rem,calc(100vw-2rem))]"
      :show-close-button="false"
    >
      <div class="search-dialog">
        <div class="query-row">
          <Search class="size-icon query-icon" />

          <input
            ref="queryInput"
            v-model="query"
            class="query-input"
            type="search"
            placeholder="搜索会话和项目"
            autocomplete="off"
            @keydown="onQueryKeydown"
          />

          <button class="query-close" type="button" title="关闭" @click="open = false">
            <X class="size-icon" />
          </button>
        </div>

        <ul v-if="hits.length" ref="hitList" class="hits">
          <li v-for="(session, index) in hits" :key="session.id">
            <button
              class="hit"
              type="button"
              :class="{ 'is-active': index === activeIndex }"
              @mouseenter="activeIndex = index"
              @click="pick(session)"
            >
              <MessageSquare class="size-icon hit-icon" />
              <span class="hit-title">{{ sessionTitle(session) }}</span>
              <CornerDownLeft v-if="index === activeIndex" :size="14" class="hit-enter" />

              <time v-else class="hit-time">
                {{ formatRelativeTime(sessionRecency(session), now) }}
              </time>
            </button>
          </li>
        </ul>

        <p v-else class="empty">没有匹配的会话</p>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { useTimestamp } from "@vueuse/core"
import { CornerDownLeft, MessageSquare, Search, X } from "@lucide/vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { Dialog, DialogContent } from "@components/ui/dialog/index.js"
import { useNav } from "@features/session-nav/index.js"
import {
  formatRelativeTime,
  sessionRecency,
  sessionTitle,
} from "@features/session-nav/lib/format.js"
import { filterSessionsForSearch } from "@features/session-nav/lib/session-list.js"

const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  navigate: [canonicalPath: string]
}>()

const { listedSessions, openSession } = useNav()

const now = useTimestamp({ interval: 60_000 })

const query = shallowRef("")

const activeIndex = shallowRef(0)

const queryInput = useTemplateRef<HTMLInputElement>("queryInput")

const hitList = useTemplateRef<HTMLElement>("hitList")

const hits = computed(() => filterSessionsForSearch(listedSessions.value, query.value))

watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ""
  activeIndex.value = 0
  void nextTick(() => queryInput.value?.focus({ preventScroll: true }))
})

watch(query, () => {
  activeIndex.value = 0
})

watch(activeIndex, async () => {
  await nextTick()
  hitList.value?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" })
})

function onQueryKeydown(event: KeyboardEvent) {
  if (event.isComposing) return

  if (event.key === "ArrowDown") {
    event.preventDefault()

    if (hits.value.length === 0) return
    activeIndex.value = Math.min(activeIndex.value + 1, hits.value.length - 1)

    return
  }

  if (event.key === "ArrowUp") {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)

    return
  }

  if (event.key !== "Enter") return
  event.preventDefault()
  const session = hits.value[activeIndex.value]

  if (session) pick(session)
}

function pick(session: SessionMetadata) {
  open.value = false

  if (session.cwd) emit("navigate", session.cwd)
  openSession(session.id)
}
</script>

<style scoped>
.search-dialog {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.query-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 48px;
  padding-inline: var(--spacing-sm) var(--spacing-xs);
  border-bottom: var(--border-width) solid var(--hairline);
}

.query-icon {
  flex: none;
  color: var(--ink-faint);
}

.query-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--text-body-md);
  outline: none;
  appearance: none;
  user-select: text;
}

.query-input::placeholder {
  color: var(--ink-faint);
}

.query-input::-webkit-search-cancel-button {
  display: none;
}

.query-close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}

.query-close:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.hits {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: min(50vh, 24rem);
  margin: 0;
  padding: var(--spacing-xs);
  overflow: auto;
  list-style: none;
}

.hit {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  text-align: start;
}

.hit.is-active {
  background: var(--interaction-selected);
}

.hit-icon {
  flex: none;
  color: var(--ink-muted);
}

.hit-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hit-enter,
.hit-time {
  flex: none;
  color: var(--ink-faint);
}

.hit-time {
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
}

.empty {
  margin: 0;
  padding: var(--spacing-lg) var(--spacing-md);
  color: var(--ink-faint);
  font-size: var(--text-caption);
  text-align: center;
}
</style>
