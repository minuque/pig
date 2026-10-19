<template>
  <div class="session-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-inset">
      <div class="nav-head">
        <div class="nav-titlebar">
          <RouterLink to="/" class="nav-brand" aria-label="pig">
            <span class="brand-mark">
              <img class="brand-pig" src="/logo-pig.png" alt="" width="22" height="22" />
            </span>

            <span class="brand-word" aria-hidden="true">pig</span>
          </RouterLink>

          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="nav-collapse"
                type="button"
                :aria-label="t('nav.collapseSidebar')"
                @click="setSbState(sbState === 'expanded' ? 'offcanvas' : 'expanded')"
              >
                <SidebarGlyph :open="sbState !== 'offcanvas'" />
              </button>
            </TooltipTrigger>

            <TooltipContent>{{ t("nav.collapseSidebar") }}</TooltipContent>
          </Tooltip>
        </div>

        <div class="search-head">
          <label class="search-field">
            <MagnifierIcon :size="15" />

            <input
              ref="searchInput"
              v-model="query"
              type="search"
              :placeholder="t('nav.search')"
              :aria-label="t('nav.searchPlaceholder')"
              @keydown.enter.prevent="activateFirst"
              @keydown.escape.prevent="query = ''"
            />

            <button
              v-if="query"
              class="search-clear"
              type="button"
              :aria-label="t('common.close')"
              @click="clearQuery"
            >
              <CloseIcon :size="11" />
            </button>
          </label>

          <div class="head-actions">
            <button
              class="head-btn"
              :class="{ scoped: !!scopeFilter }"
              type="button"
              :title="t('session.allProjects')"
              @click.stop="scopeMenuOpen = !scopeMenuOpen"
            >
              <Tuning2Icon :size="15" />
            </button>

            <button
              class="head-btn"
              type="button"
              :title="t('session.addGuide')"
              @click="onAddProject"
            >
              <AddFolderIcon :size="15" />
            </button>

            <button
              class="head-btn"
              type="button"
              :title="t('session.newSession')"
              @click="onCreateSession()"
            >
              <ChatRoundAddIcon :size="15" />
            </button>
          </div>

          <div v-if="scopeMenuOpen" class="scope-menu" @click.stop>
            <p class="scope-label">{{ t("session.grouping") }}</p>

            <button
              v-for="option in groupingOptions"
              :key="option.value"
              class="scope-item"
              :class="{ on: grouping === option.value }"
              type="button"
              @click="setGrouping(option.value)"
            >
              <span class="scope-fav"></span>
              <span class="scope-name">{{ option.label }}</span>

              <span class="scope-ck">
                <CheckIcon v-if="grouping === option.value" :size="10" />
              </span>
            </button>

            <p class="scope-label">{{ t("session.sorting") }}</p>

            <button
              v-for="option in sortOptions"
              :key="option.value"
              class="scope-item"
              :class="{ on: sort === option.value }"
              type="button"
              @click="setSort(option.value)"
            >
              <span class="scope-fav"></span>
              <span class="scope-name">{{ option.label }}</span>

              <span class="scope-ck">
                <CheckIcon v-if="sort === option.value" :size="10" />
              </span>
            </button>

            <div class="scope-sep" role="separator"></div>

            <button
              class="scope-item"
              :class="{ on: !scopeFilter }"
              type="button"
              @click="pickScope(undefined)"
            >
              <span class="scope-fav"><FolderIcon :size="12" /></span>
              <span class="scope-name">{{ t("session.allProjects") }}</span>
              <span class="scope-cnt">{{ allSessionsCount }}</span>

              <span class="scope-ck">
                <CheckIcon v-if="!scopeFilter" :size="10" />
              </span>
            </button>

            <span
              v-for="g in groups"
              :key="g.canonicalPath"
              class="scope-item"
              :class="{ on: scopeFilter === workspaceName(g.canonicalPath) }"
              role="menuitem"
              tabindex="0"
              @click="pickScope(workspaceName(g.canonicalPath))"
              @keydown.enter.prevent="pickScope(workspaceName(g.canonicalPath))"
            >
              <span class="scope-fav">
                <component :is="scopeIcon(workspaceName(g.canonicalPath))" :size="12" />
              </span>

              <span class="scope-name">{{ workspaceName(g.canonicalPath) }}</span>
              <span class="scope-cnt">{{ g.sessions.length }}</span>

              <span class="scope-ck">
                <CheckIcon v-if="scopeFilter === workspaceName(g.canonicalPath)" :size="10" />
              </span>

              <span
                class="scope-edit"
                role="button"
                tabindex="-1"
                :title="t('session.projectSettings')"
                @click.stop="closeProjectSettings(workspaceName(g.canonicalPath))"
              >
                <SettingsIcon :size="10" />
              </span>
            </span>
          </div>
        </div>
      </div>

      <p v-if="connected && !groups.length" class="add-guide">
        <ArrowUpIcon class="size-icon motion-nudge" />
        {{ t("session.addGuide") }}
      </p>

      <SessionList
        :scope-filter="scopeFilter"
        :query="query"
        @navigate="onSessionNavigate"
        @project-settings="onProjectSettings"
        @create="onCreateSession"
      />
    </div>

    <NavFooter @settings="emit('settings')" />

    <ProjectSettingsDialog
      v-if="projectSettingsOpen"
      v-model:open="projectSettingsOpen"
      :project="projectSettingsTarget"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue"
import { useEventListener } from "@vueuse/core"
import { useRouter } from "vue-router"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { notifyAction } from "@components/layout/notify.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"
import { useSound } from "@features/click-sound/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import {
  loadProjIcons,
  projectIconComponent,
  type ProjIcon,
} from "@features/session-nav/lib/project-icon.js"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import SessionList from "@features/session-nav/components/SessionList.vue"
import ProjectSettingsDialog from "@features/session-nav/components/ProjectSettingsDialog.vue"
import {
  AddFolderIcon,
  ArrowUpIcon,
  ChatRoundAddIcon,
  CheckIcon,
  CloseIcon,
  FolderIcon,
  MagnifierIcon,
  SettingsIcon,
  SidebarGlyph,
  Tuning2Icon,
} from "@components/icons/index.js"

const emit = defineEmits<{
  navigate: [canonicalPath: string]
  settings: []
}>()
const { t } = useI18n()
const { sbState, setSbState } = useLeftPanelToggle()
const {
  groups,
  pinnedSessions,
  connected,
  lastCwd,
  highlightedSessionId,
  cancelPendingOpen,
  navError: workspaceError,
  addWorkspace,
  setDraftSession,
  listedSessions,
  grouping,
  sort,
  setGrouping,
  setSort,
} = useNav()
const groupingOptions = computed(() => [
  { value: "date" as const, label: t("session.groupDate") },
  { value: "cwd" as const, label: t("session.groupCwd") },
])
const sortOptions = computed(() => [
  { value: "updated" as const, label: t("session.sortUpdated") },
  { value: "created" as const, label: t("session.sortCreated") },
])

function scopeIcon(project: string | undefined) {
  return projectIconComponent(project ? projIcons.value[project] : undefined)
}

const { play } = useSound()
const router = useRouter()
const query = shallowRef("")
const searchInput = useTemplateRef<HTMLInputElement>("searchInput")
const scopeFilter = shallowRef<string | undefined>(undefined)
const scopeMenuOpen = shallowRef(false)
const projIcons = shallowRef<Record<string, ProjIcon>>(loadProjIcons())
const allSessionsCount = computed(() =>
  groups.value.reduce((sum, group) => sum + group.sessions.length, 0),
)

function highlightedCwd(): string | undefined {
  const id = highlightedSessionId.value

  if (!id) return undefined

  const pinned = pinnedSessions.value.find((session) => session.id === id)

  if (pinned?.cwd) return canonicalizeWorkspacePath(pinned.cwd)

  for (const group of groups.value) {
    if (group.sessions.some((session) => session.id === id)) return group.canonicalPath
  }

  return undefined
}

function openSearch() {
  void play("search")
  searchInput.value?.focus()
  searchInput.value?.select()
}

function clearQuery() {
  query.value = ""
  searchInput.value?.focus()
}

function activateFirst() {
  const row = document.querySelector<HTMLElement>(".session-list .session-card")
  row?.click()
}

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return

  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return
  event.preventDefault()
  openSearch()
})

useEventListener(window, "pointerdown", (event) => {
  if (!scopeMenuOpen.value) return
  const target = event.target

  if (target instanceof Element && target.closest(".scope-menu, .head-btn")) return
  scopeMenuOpen.value = false
})

watch(workspaceError, (message) => {
  const text = message.trim()

  if (text) notifyAction(text)
})

function onSessionNavigate(cwd: string | undefined): void {
  if (cwd) emit("navigate", cwd)
}

function onCreateInDir(canonicalPath: string): void {
  void play("create")
  cancelPendingOpen()
  setDraftSession(canonicalPath)
  emit("navigate", canonicalPath)
  void router.push("/")
}

function pickScope(name: string | undefined): void {
  scopeFilter.value = name
  scopeMenuOpen.value = false
}

function onProjectSettings(project: string): void {
  projectSettingsTarget.value = project
  projectSettingsOpen.value = true
}

function closeProjectSettings(project: string): void {
  onProjectSettings(project)
  scopeMenuOpen.value = false
}

const projectSettingsOpen = shallowRef(false)
const projectSettingsTarget = shallowRef("")

function onAddProject(): void {
  void play("create")
  void addWorkspace()
}

function onCreateSession(cwd?: string): void {
  const path = cwd ?? highlightedCwd() ?? lastCwd.value ?? groups.value[0]?.canonicalPath

  if (path) return onCreateInDir(path)
  void play("create")
  void addWorkspace()
}
</script>

<style scoped>
.session-nav {
  --nav-inline: var(--spacing-xs);
  position: relative;
  isolation: isolate;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  user-select: none;
}

.nav-inset {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding-block-start: var(--spacing-xxs);
  padding-inline: var(--nav-inline);
}

.nav-head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  margin-inline: calc(-1 * var(--nav-inline));
  padding-inline: var(--nav-inline);
  border-bottom: var(--border-width) solid var(--border-subtle);
}

.nav-titlebar {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.nav-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  margin-inline-start: calc(-1 * var(--spacing-xxs));
  padding: var(--spacing-xxs);
  border-radius: var(--radius-md);
  color: var(--contrast-foreground);
  text-decoration: none;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.nav-brand:hover,
.nav-brand:focus-visible {
  background: var(--interaction-hover);
}

.brand-mark {
  display: block;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--brand-mark-bg);
}

.brand-pig {
  display: block;
  transform-origin: 30% 100%;
}

.nav-brand:hover .brand-pig,
.nav-brand:focus-visible .brand-pig {
  animation: brand-peek var(--duration-pig-peek) both;
}

.brand-word {
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: var(--text-title);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
}

.nav-collapse {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  margin-inline-start: auto;
  padding: var(--icon-button-pad);
  -webkit-app-region: no-drag;
  app-region: no-drag;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
}

.nav-collapse:hover,
.nav-collapse:focus-visible {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.search-head {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xxs);
}

/* 渐隐带要落在 nav-head 的分隔线之下：压在线上会把中间那段线盖掉。 */
.search-head::after {
  content: "";
  position: absolute;
  z-index: 1;
  inset-inline: 0;
  top: calc(100% + var(--border-width));
  height: var(--edge-fade-band);
  background: linear-gradient(to bottom, var(--sidebar), transparent);
  pointer-events: none;
}

.search-field {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: 32px;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  color: var(--contrast-foreground-muted);
  cursor: text;
}

.search-field:hover,
.search-field:focus-within {
  background: var(--interaction-hover);
}

.search-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
}

.search-field input::placeholder {
  color: var(--contrast-foreground-faint);
}

.search-clear,
.head-btn {
  display: grid;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
}

.search-clear {
  width: 20px;
  height: 20px;
}

.head-actions {
  display: flex;
  flex: none;
  align-items: center;
}

.head-btn {
  position: relative;
  width: 28px;
  height: 28px;
}

.head-btn:hover,
.search-clear:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.head-btn.scoped {
  color: var(--primary);
}

.head-btn.scoped::after {
  content: "";
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--primary);
  translate: -50% 0;
}

.session-nav > .titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .session-nav > .titlebar-drag {
  display: block;
}

html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}

html[data-pig-desktop-platform] .nav-titlebar {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: calc(6px + var(--titlebar-inset));
  padding-inline: var(--nav-inline);
}

html[data-pig-desktop-platform="win32"] .session-nav {
  padding-top: var(--titlebar-inset);
}

html[data-pig-desktop-platform="win32"] .nav-titlebar {
  height: var(--titlebar-inset);
}

html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: var(--spacing-xxl);
}

html[data-pig-desktop-platform="darwin"] .nav-titlebar {
  height: var(--spacing-xxl);
}

.add-guide {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xxs);
  margin: 0;
  padding-block: var(--spacing-xxs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.add-guide .motion-nudge {
  margin-inline-start: var(--spacing-xs);
}

.scope-label {
  margin: 0;
  padding: var(--spacing-xxs) var(--spacing-xs) 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.scope-sep {
  height: 1px;
  margin-block: var(--spacing-xxs);
  background: var(--border);
}

.scope-fav {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.scope-menu {
  position: absolute;
  z-index: var(--z-menu);
  inset-inline: 0;
  top: 100%;
  max-height: min(60vh, 480px);
  overflow-y: auto;
  margin-block-start: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--card);
  box-shadow: var(--shadow-float);
  font-size: var(--text-caption);
}

.scope-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  width: 100%;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
  text-align: start;
  cursor: default;
  user-select: none;
}

.scope-item:hover {
  background: var(--sidebar-hover);
}

.scope-item.on {
  color: var(--primary);
}

.scope-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-cnt {
  flex: none;
  font-size: var(--text-eyebrow);
  color: var(--contrast-foreground-muted);
}

.scope-ck {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  color: var(--primary);
}

.scope-edit {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
  opacity: 0;
  transition: opacity 0.15s;
  cursor: pointer;
}

.scope-item:hover .scope-edit {
  opacity: 1;
}

.scope-edit:hover {
  color: var(--contrast-foreground);
}

@media (max-width: 900px) {
  .session-nav {
    --nav-inline: var(--spacing-md);
  }
}

@media (prefers-reduced-motion: reduce) {
  .search-field {
    transition: none;
  }

  .nav-brand:hover .brand-pig,
  .nav-brand:focus-visible .brand-pig {
    animation: none;
  }
}
</style>
