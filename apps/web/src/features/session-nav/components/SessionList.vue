<template>
  <nav class="nav-body session-list">
    <section v-if="pinnedRows.length" class="nav-section is-pin">
      <div class="section-label" @click="collapsedSections.pinned = !collapsedSections.pinned">
        <span class="section-label-text">{{ t("session.pin") }}</span>

        <button
          class="section-fold"
          type="button"
          :aria-expanded="!collapsedSections.pinned"
          :aria-label="collapsedSections.pinned ? t('nav.expandPinned') : t('nav.collapsePinned')"
          @click.stop="collapsedSections.pinned = !collapsedSections.pinned"
        >
          <AltArrowDownIcon v-if="!collapsedSections.pinned" class="size-icon" />
          <AltArrowRightIcon v-else class="size-icon" />
        </button>
      </div>

      <div
        class="session-list-group"
        :class="{ 'is-open': pinnedOpen }"
        :inert="collapsedSections.pinned"
      >
        <TransitionGroup v-if="pinnedMounted" name="list-reveal" tag="div" class="group-body">
          <SessionItem
            v-for="session in pinnedRows"
            :key="session.id"
            v-bind="
              itemBind(session, {
                pinned: true,
                dirTag: session.cwd ? workspaceName(session.cwd) : undefined,
              })
            "
            @navigate="emit('navigate', session.cwd)"
            @toggle-pinned="togglePinned"
            @rename="renameSession"
            @delete="deleteSession"
          />
        </TransitionGroup>
      </div>
    </section>

    <div class="head-sticky">
      <SessionsHead
        v-if="connected || groups.length"
        :view="view"
        :sort="sort"
        :all-collapsed="allCollapsed"
        :can-fold="view === 'grouped' && groupRows.length > 0"
        :collapsed="collapsedSections.sessions"
        :can-collapse="hasList"
        @toggle-all="toggleAllGroups"
        @toggle-collapse="collapsedSections.sessions = !collapsedSections.sessions"
        @set-view="setView"
        @set-sort="setSort"
      />
    </div>

    <div
      v-if="sessionsMounted && sessionRows.length"
      v-bind="containerProps"
      class="session-window"
      :inert="collapsedSections.sessions"
    >
      <ul ref="groupList" v-bind="wrapperProps" :class="{ 'is-dragging': dragging }">
        <li
          v-for="{ data, index } in list"
          :key="data.key"
          class="session-row"
          :class="rowClass(data)"
          :data-id="data.kind === 'group' ? data.key : undefined"
          :data-index="index"
          :style="rowStyle(index)"
        >
          <GroupHead
            v-if="data.kind === 'group'"
            :name="workspaceName(data.canonicalPath)"
            :sortable="sort === 'manual'"
            :collapsed="data.collapsed"
            @toggle="toggleGroup(data.canonicalPath)"
            @create="emit('createInDir', data.canonicalPath)"
          />

          <SessionItem
            v-else-if="data.kind === 'session'"
            v-bind="itemBind(data.session)"
            @navigate="emit('navigate', data.session.cwd)"
            @toggle-pinned="togglePinned"
            @rename="renameSession"
            @delete="deleteSession"
          />

          <button
            v-else
            class="more-button"
            type="button"
            @click="toggleGroupReveal(data.groupKey)"
          >
            {{ data.revealed ? t("common.collapse") : t("common.showMore") }}
          </button>
        </li>
      </ul>
    </div>

    <span v-else-if="groups.length && !collapsedSections.sessions">{{ t("session.empty") }}</span>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, shallowRef, useTemplateRef, watch } from "vue"
import { useTimestamp, useVirtualList } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionsHead from "@features/session-nav/components/SessionsHead.vue"
import { useSectionFold } from "@features/session-nav/hooks/use-section-fold.js"
import { useDragReorder } from "@utils/motion.js"
import { toSidebarSession } from "@features/session-nav/lib/session-list.js"
import type { SidebarRow, SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"
import { AltArrowDownIcon, AltArrowRightIcon } from "@components/icons/index.js"

const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  createInDir: [canonicalPath: string]
}>()
const { t } = useI18n()
const {
  groups,
  cardFootById,
  view,
  sort,
  setView,
  setSort,
  reorderGroups,
  toggleGroupReveal,
  toggleGroup,
  setGroupsCollapsed,
  rowsFor,
  pinnedIds,
  pinnedSessions,
  togglePinned,
  connected,
  highlightedSessionId,
  renameSession,
  deleteSession,
} = useNav()
const now = useTimestamp({ interval: 60_000 })
const collapsedSections = reactive({ pinned: false, sessions: false })
// 折叠过渡后卸载列表内容；flat 与 grouped 互斥分支共用同一份状态
const { open: pinnedOpen, mounted: pinnedMounted } = useSectionFold(() => collapsedSections.pinned)
const { mounted: sessionsMounted } = useSectionFold(() => collapsedSections.sessions)
const rows = rowsFor(false)
const groupRows = computed(() =>
  rows.value.filter((row): row is Extract<SidebarRow, { kind: "group" }> => row.kind === "group"),
)
const flatRows = computed(() => rows.value.filter((row) => row.kind !== "group"))
const sessionRows = computed(() => (view.value === "grouped" ? rows.value : flatRows.value))
const ROW_HEIGHT = 32
const {
  list,
  containerProps: virtualContainer,
  wrapperProps,
} = useVirtualList(sessionRows, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
})
const containerProps = computed(() => ({
  ...virtualContainer,
  style: { ...(virtualContainer.style as { overflowY: "auto" }), scrollbarWidth: "none" as const },
}))
const groupList = useTemplateRef<HTMLElement>("groupList")
const dragging = shallowRef(false)
const reorder = useDragReorder({
  axis: "y",
  container: () => groupList.value,
  itemSelector: ".row-group",
  handleSelector: ".group-head",
  onMove: (id, toIndex) => {
    const paths = groupRows.value.map((row) => row.canonicalPath)
    const from = groupRows.value.findIndex((row) => row.key === id)
    const visible = [...(groupList.value?.querySelectorAll<HTMLElement>(".row-group") ?? [])]
    const over = visible[toIndex]?.dataset.id
    const target = over ? groupRows.value.findIndex((row) => row.key === over) : -1

    if (from < 0 || target < 0 || from === target) return
    const moving = groupRows.value[from]

    if (!moving) return
    const next = paths.filter((_, i) => i !== from)
    next.splice(target, 0, moving.canonicalPath)
    reorderGroups(next)
  },
})

/* <ul> 在 sessionsMounted 之后才渲染，不能指望 onMounted 有值；
   元素一旦出现或换根，重新挂 pointerdown。 */
watch(
  groupList,
  (el, _prev, onCleanup) => {
    if (!el || view.value !== "grouped") return
    onCleanup(reorder.attach(el))
    el.addEventListener("pointerdown", startDrag)
    onCleanup(() => el.removeEventListener("pointerdown", startDrag))
  },
  { immediate: true },
)

function startDrag(event: PointerEvent) {
  const target = event.target

  if (!(target instanceof Element) || !target.closest(".group-head")) return
  dragging.value = true
  window.addEventListener("pointerup", endDrag)
  window.addEventListener("pointercancel", endDrag)
}

function endDrag() {
  dragging.value = false
  window.removeEventListener("pointerup", endDrag)
  window.removeEventListener("pointercancel", endDrag)
}

onBeforeUnmount(endDrag)

const hasList = computed(() => sessionRows.value.some((row) => row.kind !== "more"))
const pinnedRows = computed(() => pinnedSessions.value.map(toSidebarSession))
const allCollapsed = computed(
  () => groupRows.value.length > 0 && groupRows.value.every((row) => row.collapsed),
)

function toggleAllGroups() {
  setGroupsCollapsed(!allCollapsed.value)
}

/** 窗口内最上面的组头吸在会话区顶，其余组头跟着滚动。拖拽时不吸，避免让位被吸顶钉住。 */
function rowStyle(index: number) {
  const row = sessionRows.value[index]

  if (dragging.value || row?.kind !== "group") return undefined
  const next = sessionRows.value[index + 1]
  return next?.kind === "group" || next === undefined ? undefined : { top: "0px" }
}

function rowClass(row: SidebarRow) {
  return {
    "row-group": row.kind === "group",
    "is-manual": row.kind === "group" && sort.value === "manual",
    "is-more": row.kind === "more",
  }
}

function sessionState(id: string): SidebarSessionState | undefined {
  return cardFootById.value.get(id)?.state
}

function itemBind(
  session: SidebarSession,
  extra?: { pinned?: boolean; showPath?: boolean; dirTag?: string | undefined },
) {
  return {
    session,
    active: session.id === highlightedSessionId.value,
    pinned: extra?.pinned ?? pinnedIds.value.has(session.id),
    showPath: extra?.showPath ?? false,
    dirTag: extra?.dirTag,
    state: sessionState(session.id),
    placeholder: session.draft ?? false,
    now: now.value,
  }
}
</script>

<style scoped>
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.session-list {
  position: relative;
  gap: var(--spacing-xxs);
}

.session-window {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  scrollbar-width: none;
}

.session-window::-webkit-scrollbar {
  display: none;
}

.session-list ul {
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.session-row {
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  height: 32px;
  min-width: 0;
}

.nav-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.nav-section.is-pin {
  position: relative;
  z-index: 3;
  background: var(--sidebar);
}

.head-sticky {
  position: relative;
  z-index: 2;
  background: var(--sidebar);
}

.session-window:not(:has(.is-dragging)) .row-group[style] {
  position: sticky;
  z-index: 1;
  background: var(--sidebar);
}

.row-group.is-manual .group-head {
  cursor: grab;
}

/* 拖拽跟手：阴影只加在组头，整组阴影会溢到滚动区外被切成黑边 */
.row-group.is-drag-live {
  z-index: 4;
  cursor: grabbing;
}

.row-group.is-drag-live .group-head {
  background: var(--sidebar);
  box-shadow: var(--shadow-float);
}

.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  min-height: var(--size-icon-button);
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
}

.section-label:hover {
  background: var(--interaction-hover);
}

.section-label-text {
  min-width: 0;
  overflow: hidden;
  color: var(--contrast-ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-bold);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-fold {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-ink-muted);
}

.section-fold:hover,
.section-fold:focus-visible {
  background: var(--hover-quiet);
  color: var(--contrast-ink);
}

@media (hover: hover) {
  .section-fold {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .section-label:is(:hover, :focus-within) .section-fold,
  .section-fold:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }
}

.group-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-block-start: var(--spacing-xxs);
}

.more-button {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-ink-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.session-row.is-more {
  padding-inline-start: calc(var(--spacing-xs) + var(--size-icon) + var(--spacing-xxs));
}

.more-button:hover,
.more-button:focus-visible {
  background: transparent;
  color: var(--contrast-ink);
}
</style>
