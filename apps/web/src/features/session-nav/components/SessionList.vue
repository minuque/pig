<template>
  <nav ref="navBody" class="nav-body session-list">
    <section v-if="pinnedRows.length" ref="pinnedSection" class="nav-section is-pin">
      <div class="section-label" @click="collapsedSections.pinned = !collapsedSections.pinned">
        <span class="section-label-text">{{ t("session.pin") }}</span>

        <button
          class="section-fold"
          type="button"
          :aria-expanded="!collapsedSections.pinned"
          :aria-label="collapsedSections.pinned ? t('nav.expandPinned') : t('nav.collapsePinned')"
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
            {{ updatedMore.revealed ? t("common.collapse") : t("common.showMore") }}
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
                {{ section.revealed ? t("common.collapse") : t("common.showMore") }}
              </button>
            </TransitionGroup>
          </div>
        </li>
      </ul>
    </div>

    <span v-else-if="groups.length && !collapsedSections.sessions">{{ t("session.empty") }}</span>
  </nav>
</template>

<script setup lang="ts">
import { computed, reactive, useTemplateRef, watch } from "vue"
import { useResizeObserver, useTimestamp } from "@vueuse/core"
import { ChevronDown, ChevronRight } from "@lucide/vue"
import { useI18n } from "@i18n/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionsHead from "@features/session-nav/components/SessionsHead.vue"
import { useGroupReorder } from "@features/session-nav/hooks/use-group-reorder.js"
import { useSectionFold } from "@features/session-nav/hooks/use-section-fold.js"
import { toSidebarSession } from "@features/session-nav/lib/session-list.js"
import type { SidebarRow, SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"

const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  createInDir: [canonicalPath: string]
}>()
const { t } = useI18n()
// 置顶区高度随内容变，吸顶位置只有浏览器量完才知道
const navBody = useTemplateRef<HTMLElement>("navBody")
const pinnedSection = useTemplateRef<HTMLElement>("pinnedSection")
const headSticky = useTemplateRef<HTMLElement>("headSticky")

function publishPinHeight() {
  const body = navBody.value

  if (!body) return
  body.style.setProperty("--pin-stick", `${pinnedSection.value?.offsetHeight ?? 0}px`)
  body.style.setProperty("--head-stick", `${headSticky.value?.offsetHeight ?? 0}px`)
}

useResizeObserver(pinnedSection, publishPinHeight)

useResizeObserver(headSticky, publishPinHeight)

watch([pinnedSection, headSticky], publishPinHeight, { flush: "post" })

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
  /* 目录头吸在会话表头下沿，表头实高由浏览器写进 --head-stick */
  scroll-padding-top: calc(var(--pin-stick, 0px) + var(--head-stick, var(--size-icon-button)));
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

/* 置顶区钉在滚动容器顶。底边距折进区内，表头才能紧贴它的底边吸住。
   实高由浏览器写进 --pin-stick，表头和目录头都靠它定位 */
.nav-section.is-pin {
  position: sticky;
  top: 0;
  z-index: 3;
  margin-block-end: calc(-1 * var(--spacing-xxs));
  padding-block-end: var(--spacing-xxs);
  background: var(--sidebar);
}

.head-sticky {
  position: sticky;
  top: var(--pin-stick, 0px);
  z-index: 2;
  /* 和置顶区一样把下间距折进表头，目录头紧贴表头底边，滚动内容不从缝里露出 */
  margin-block-end: calc(-1 * var(--spacing-xxs));
  padding-block-end: var(--spacing-xxs);
  background: var(--sidebar);
}

.row-group .group-head {
  position: sticky;
  top: calc(var(--pin-stick, 0px) + var(--head-stick, var(--size-icon-button)));
  z-index: 1;
}

/* 实底只在非 hover 时铺上，hover 的高亮背景才能露出来 */
.row-group .group-head:not(:hover) {
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
