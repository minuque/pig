<template>
  <nav ref="navBody" class="nav-body session-list">
    <section v-if="pinnedRows.length" ref="pinnedSection" class="nav-section is-pin">
      <div class="section-label" @click="collapsedSections.pinned = !collapsedSections.pinned">
        <span class="section-label-text">置顶</span>

        <button
          class="section-fold"
          type="button"
          :aria-expanded="!collapsedSections.pinned"
          :aria-label="collapsedSections.pinned ? '展开置顶' : '折叠置顶'"
          @click.stop="collapsedSections.pinned = !collapsedSections.pinned"
        >
          <ChevronDown v-if="!collapsedSections.pinned" class="size-icon" />
          <ChevronRight v-else class="size-icon" />
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

    <div ref="headSticky" class="head-sticky">
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
      v-if="view === 'flat' && updatedSessions.length"
      class="session-list-group"
      :class="{ 'is-open': sessionsOpen }"
      :inert="collapsedSections.sessions"
    >
      <TransitionGroup v-if="sessionsMounted" name="list-reveal" tag="ul" class="flat-sessions">
        <li v-for="session in updatedSessions" :key="session.id">
          <SessionItem
            v-bind="itemBind(session)"
            @navigate="emit('navigate', session.cwd)"
            @toggle-pinned="togglePinned"
            @rename="renameSession"
            @delete="deleteSession"
          />
        </li>

        <li v-if="updatedMore" key="more">
          <button class="more-button" type="button" @click="toggleGroupReveal('updated')">
            {{ updatedMore.revealed ? "收起" : "显示更多" }}
          </button>
        </li>
      </TransitionGroup>
    </div>

    <div
      v-else-if="view === 'grouped' && showList"
      class="session-list-group"
      :class="{ 'is-open': sessionsOpen }"
      :inert="collapsedSections.sessions"
    >
      <ul v-if="sessionsMounted">
        <li
          v-for="section in listSections"
          :key="section.key"
          :class="groupClass(section.key, section.open)"
          @dragover.prevent="onGroupDragOver(section.key, $event)"
          @drop.prevent="onGroupDrop(section.key)"
          @dragend="clearGroupDrag"
        >
          <GroupHead
            :name="section.name"
            :sortable="sort === 'manual'"
            :collapsed="section.collapsed"
            @dragstart="onGroupDragStart(section.key, $event)"
            @toggle="section.toggle"
            @create="section.create?.()"
          />

          <div
            v-if="section.sessions.length > 0 || section.more"
            class="session-list-group"
            :class="{ 'is-open': !section.collapsed }"
          >
            <TransitionGroup name="list-reveal" tag="div" class="group-body">
              <SessionItem
                v-for="session in section.sessions"
                :key="session.id"
                v-bind="itemBind(session)"
                @navigate="emit('navigate', session.cwd)"
                @toggle-pinned="togglePinned"
                @rename="renameSession"
                @delete="deleteSession"
              />

              <button
                v-if="section.more"
                key="more"
                class="more-button"
                type="button"
                @click="section.toggleReveal"
              >
                {{ section.revealed ? "收起" : "显示更多" }}
              </button>
            </TransitionGroup>
          </div>
        </li>
      </ul>
    </div>

    <span v-else-if="groups.length && !collapsedSections.sessions">暂无会话</span>
  </nav>
</template>

<script setup lang="ts">
import { computed, reactive, useTemplateRef, watch } from "vue"
import { useResizeObserver, useTimestamp } from "@vueuse/core"
import { ChevronDown, ChevronRight } from "@lucide/vue"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionsHead from "@features/session-nav/components/SessionsHead.vue"
import { useGroupReorder } from "@features/session-nav/hooks/use-group-reorder.js"
import { useSectionFold } from "@features/session-nav/hooks/use-section-fold.js"
import { stickyOffsets } from "@features/session-nav/lib/sticky-offsets.js"
import { toSidebarSession } from "@features/session-nav/lib/session-list.js"
import type { SidebarRow, SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"

const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  createInDir: [canonicalPath: string]
}>()
// 粘性叠层：置顶区钉顶，目录头比夹在会话表头之下；表头偏移随置顶区高度实时重算
const navBody = useTemplateRef<HTMLElement>("navBody")
const pinnedSection = useTemplateRef<HTMLElement>("pinnedSection")
const headSticky = useTemplateRef<HTMLElement>("headSticky")

function publishStickOffsets() {
  const body = navBody.value

  if (!body) return
  const style = getComputedStyle(body)
  const offsets = stickyOffsets(
    pinnedSection.value?.offsetHeight ?? 0,
    headSticky.value?.offsetHeight ?? 0,
    Number.parseFloat(style.rowGap) || 0,
    Number.parseFloat(style.paddingTop) || 0,
  )

  body.style.setProperty("--pin-stick", `${offsets.pin}px`)
  body.style.setProperty("--head-stick", `${offsets.head}px`)
  body.style.setProperty("--pin-tail", `${offsets.tail}px`)
}

useResizeObserver(pinnedSection, publishStickOffsets)

useResizeObserver(headSticky, publishStickOffsets)

watch([pinnedSection, headSticky], publishStickOffsets, { flush: "post" })

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
const { open: sessionsOpen, mounted: sessionsMounted } = useSectionFold(
  () => collapsedSections.sessions,
)
const rows = rowsFor(false)
const showList = computed(() => rows.value.some((row) => row.kind !== "more"))
const groupRows = computed(() =>
  rows.value.filter((row): row is Extract<SidebarRow, { kind: "group" }> => row.kind === "group"),
)
const { dropLine, onGroupDragStart, onGroupDragOver, onGroupDrop, clearGroupDrag } =
  useGroupReorder(groupRows, reorderGroups)
const updatedSessions = computed(() =>
  rows.value.flatMap((row) => (row.kind === "session" ? [row.session] : [])),
)
const updatedMore = computed(() => rows.value.find((row) => row.kind === "more"))
const hasList = computed(() =>
  view.value === "flat" ? updatedSessions.value.length > 0 : showList.value,
)
const pinnedRows = computed(() => pinnedSessions.value.map(toSidebarSession))
const listSections = computed(() =>
  groupRows.value.map((row) => ({
    key: row.key,
    name: workspaceName(row.canonicalPath),
    collapsed: row.collapsed,
    open: !row.collapsed && (row.sessions.length > 0 || row.more),
    sessions: row.sessions,
    more: row.more,
    revealed: row.revealed,
    toggleReveal: () => toggleGroupReveal(row.key),
    toggle: () => toggleGroup(row.canonicalPath),
    create: () => emit("createInDir", row.canonicalPath),
  })),
)
const allCollapsed = computed(
  () => groupRows.value.length > 0 && groupRows.value.every((row) => row.collapsed),
)

function toggleAllGroups() {
  setGroupsCollapsed(!allCollapsed.value)
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

function groupClass(key: string, open: boolean) {
  return {
    "row-group": true,
    "is-open": open,
    "is-manual": sort.value === "manual",
    "drop-before": dropLine.value?.key === key && dropLine.value.place === "before",
    "drop-after": dropLine.value?.key === key && dropLine.value.place === "after",
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
  overflow: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.session-list {
  position: relative;
  gap: var(--spacing-xxs);
  scroll-padding-top: var(--head-stick, 0px);
  /* 尾部留白只在内容溢出时生效，短列表不受影响 */
  padding-bottom: var(--pin-tail, 0px);
}

.nav-body::-webkit-scrollbar {
  display: none;
}

.session-list ul {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-section,
.row-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 置顶区钉在滚动容器顶，会话表头与目录头依次吸在其下。
   每层向下多铺一格间距的实底，盖住层与层之间的缝，滚动内容不透出来 */
.nav-section.is-pin {
  position: sticky;
  top: 0;
  z-index: 3;
  padding-block-end: var(--spacing-xxs);
  background: var(--sidebar);
  box-shadow: 0 var(--spacing-xxs) 0 var(--sidebar);
}

.head-sticky {
  position: sticky;
  top: var(--pin-stick, 0px);
  z-index: 2;
  background: var(--sidebar);
  box-shadow: 0 var(--spacing-xxs) 0 var(--sidebar);
}

.row-group .group-head {
  position: sticky;
  top: var(--head-stick, 0px);
  z-index: 1;
  background: var(--sidebar);
}

.row-group.is-manual .group-head {
  cursor: grab;
}

.row-group.drop-before,
.row-group.drop-after {
  position: relative;
}

.row-group.drop-before::before,
.row-group.drop-after::after {
  content: "";
  position: absolute;
  z-index: 1;
  right: var(--spacing-xs);
  left: var(--spacing-xs);
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--primary);
  pointer-events: none;
}

.row-group.drop-before::before {
  top: calc(var(--spacing-xs) / -2);
}

.row-group.drop-after::after {
  bottom: calc(var(--spacing-xs) / -2);
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
  color: var(--ink-faint);
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
  color: var(--ink-muted);
}

.section-fold:hover,
.section-fold:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
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
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--size-scroll-control);
  padding-inline: calc(var(--spacing-xs) + var(--size-icon) + var(--spacing-xxs)) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
}

.more-button:hover,
.more-button:focus-visible {
  background: var(--interaction-hover);
  color: var(--ink);
}
</style>
