<template>
  <Dialog v-model:open="open">
    <DialogContent class="settings-dialog">
      <DialogTitle>{{ t("session.projectSettings") }}</DialogTitle>
      <p class="settings-sub">{{ project }} · {{ t("session.customIcon") }}</p>
      <div class="settings-label">{{ t("session.icon") }}</div>

      <div class="settings-tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          class="settings-tab"
          :class="{ on: activeTab === tab }"
          type="button"
          @click="activeTab = tab"
        >
          {{ tabLabel(tab) }}
        </button>
      </div>

      <div class="settings-body">
        <div class="settings-label">{{ t("session.color") }}</div>

        <div class="color-row">
          <button
            v-for="c in COLORS"
            :key="c"
            class="color-swatch"
            :class="{ on: sel.color === c }"
            :style="{ background: swatchHex(c) }"
            type="button"
            @click="sel.color = c"
          />
        </div>

        <div v-if="activeTab === 'icon'" class="icon-pane">
          <input
            v-model="iconQuery"
            class="icon-search"
            type="text"
            :placeholder="t('session.searchIcon')"
          />

          <div class="icon-grid">
            <button
              v-for="entry in filteredIcons"
              :key="entry.key"
              class="icon-cell"
              :class="{ on: sel.kind === 'icon' && sel.value === entry.key }"
              :style="{ color: accentHex(sel.color) }"
              type="button"
              @click="pick('icon', entry.key)"
            >
              <component :is="entry.icon" :size="16" />
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'emoji'" class="icon-pane">
          <div class="emoji-grid">
            <button
              v-for="e in EMOJIS"
              :key="e"
              class="emoji-cell"
              :class="{ on: sel.kind === 'emoji' && sel.value === e }"
              type="button"
              @click="pick('emoji', e)"
            >
              {{ e }}
            </button>
          </div>
        </div>

        <div v-else class="mono-pane">
          <input
            v-model="monoText"
            class="mono-input"
            maxlength="2"
            :placeholder="project.slice(0, 2).toUpperCase()"
            @input="onMonoInput"
          />

          <span class="mono-preview" :style="{ background: accentHex(sel.color) }">
            {{ monoPreview }}
          </span>

          <span class="mono-hint">{{ t("session.monoHint") }}</span>
        </div>
      </div>

      <div class="settings-foot">
        <button class="btn auto" type="button" @click="reset">{{ t("session.resetIcon") }}</button>

        <DialogClose as-child>
          <button class="btn" type="button">{{ t("common.cancel") }}</button>
        </DialogClose>

        <button class="btn primary" type="button" @click="save">{{ t("common.save") }}</button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import { readJson, writeJson } from "@utils/storage.js"
import { isAccentId } from "@features/theme/lib/accents.js"
import { FolderIcon } from "@components/icons/index.js"
import { ACCENTS, DEFAULT_ACCENT_ID, type AccentId } from "@features/theme/lib/accents.js"
import { accentHex } from "@features/theme/lib/palette.js"
import { useColorScheme } from "@features/theme/index.js"
import { CodeSquareIcon } from "@solar-icons/vue/linear/code-square"
import { MonitorIcon } from "@solar-icons/vue/linear/monitor"
import { StarsMinimalisticIcon } from "@solar-icons/vue/linear/stars-minimalistic"
import { Book2Icon } from "@solar-icons/vue/linear/book-2"
import { ShieldIcon } from "@solar-icons/vue/linear/shield"
import { GameboyIcon } from "@solar-icons/vue/linear/gameboy"
import { MusicNoteIcon } from "@solar-icons/vue/linear/music-note"
import { BoltIcon } from "@solar-icons/vue/linear/bolt"
import { BoxIcon } from "@solar-icons/vue/linear/box"
import { StarIcon } from "@solar-icons/vue/linear/star"
import { HeartIcon } from "@solar-icons/vue/linear/heart"
import { LeafIcon } from "@solar-icons/vue/linear/leaf"
import { GlobeIcon } from "@solar-icons/vue/linear/globe"
import { DatabaseIcon } from "@solar-icons/vue/linear/database"
import { BotIcon } from "@solar-icons/vue/linear/bot"
import { PhoneIcon } from "@solar-icons/vue/linear/phone"
import { RocketIcon } from "@solar-icons/vue/linear/rocket"
import { TestTubeIcon } from "@solar-icons/vue/linear/test-tube"
import { GalleryIcon } from "@solar-icons/vue/linear/gallery"
import { GitBranchIcon } from "@solar-icons/vue/linear/git-branch"
import { ToolboxIcon } from "@solar-icons/vue/linear/toolbox"
import type { Component } from "vue"

const props = defineProps<{
  project: string
}>()
const { t } = useI18n()
const { isDark } = useColorScheme()
const open = defineModel<boolean>("open", { default: false })
const KEY = "pig.projIcons"
const COLORS = ACCENTS.map((accent) => accent.id)
const EMOJIS = [
  "🚀",
  "🎯",
  "💡",
  "🔧",
  "🐛",
  "📝",
  "🎨",
  "🧪",
  "📦",
  "🗂️",
  "⚡",
  "🔥",
  "🌱",
  "🍀",
  "🎵",
  "📊",
  "🛡️",
  "🧩",
  "🏗️",
  "🤖",
]
const ICONS: { key: string; icon: Component }[] = [
  { key: "folder", icon: FolderIcon },
  { key: "code", icon: CodeSquareIcon },
  { key: "terminal", icon: MonitorIcon },
  { key: "globe", icon: GlobeIcon },
  { key: "database", icon: DatabaseIcon },
  { key: "robot", icon: BotIcon },
  { key: "stars", icon: StarsMinimalisticIcon },
  { key: "phone", icon: PhoneIcon },
  { key: "monitor", icon: MonitorIcon },
  { key: "rocket", icon: RocketIcon },
  { key: "book", icon: Book2Icon },
  { key: "flask", icon: TestTubeIcon },
  { key: "shield", icon: ShieldIcon },
  { key: "game", icon: GameboyIcon },
  { key: "music", icon: MusicNoteIcon },
  { key: "image", icon: GalleryIcon },
  { key: "git", icon: GitBranchIcon },
  { key: "wrench", icon: ToolboxIcon },
  { key: "box", icon: BoxIcon },
  { key: "star", icon: StarIcon },
  { key: "heart", icon: HeartIcon },
  { key: "leaf", icon: LeafIcon },
  { key: "bolt", icon: BoltIcon },
]

type IconKind = "icon" | "emoji" | "monogram"

interface ProjIcon {
  kind: IconKind
  value: string
  color: AccentId
}

function loadIcons(): Record<string, ProjIcon> {
  return readJson<Record<string, ProjIcon>>(KEY) ?? {}
}

const activeTab = ref<IconKind>("icon")
const iconQuery = ref("")
const monoText = ref("")
const cur = loadIcons()[props.project]
const sel = reactive<ProjIcon>(
  cur
    ? { ...cur, color: isAccentId(cur.color) ? cur.color : DEFAULT_ACCENT_ID }
    : { kind: "icon", value: "folder", color: DEFAULT_ACCENT_ID },
)

if (cur) {
  activeTab.value = cur.kind

  if (cur.kind === "monogram") monoText.value = cur.value
}

const tabs: IconKind[] = ["icon", "emoji", "monogram"]

function swatchHex(id: AccentId) {
  void isDark.value
  return accentHex(id)
}

const tabLabel = (tab: IconKind) =>
  tab === "icon" ? t("session.tabIcon") : tab === "emoji" ? "Emoji" : t("session.tabMono")
const filteredIcons = computed(() => {
  const q = iconQuery.value.trim().toLowerCase()
  return q ? ICONS.filter((i) => i.key.includes(q)) : ICONS
})
const monoPreview = computed(() => monoText.value.toUpperCase().slice(0, 2) || "?")

function pick(kind: IconKind, value: string) {
  sel.kind = kind
  sel.value = value
}

function onMonoInput() {
  sel.kind = "monogram"
  sel.value = monoText.value.toUpperCase().slice(0, 2)
}

function reset() {
  const icons = loadIcons()
  delete icons[props.project]
  writeJson(KEY, icons)
  open.value = false
}

function save() {
  if (sel.kind === "monogram" && !sel.value) {
    sel.value = props.project.slice(0, 2).toUpperCase()
  }

  const icons = loadIcons()
  icons[props.project] = { ...sel }
  writeJson(KEY, icons)
  open.value = false
}
</script>

<style scoped>
.settings-sub {
  margin: 0;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.settings-label {
  margin-block-start: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.03em;
}

.settings-tabs {
  display: flex;
  gap: var(--space-xxs);
  margin-block-start: var(--space-xxs);
}

.settings-tab {
  padding: var(--space-xxs) var(--space-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.settings-tab:hover {
  color: var(--contrast-foreground);
}

.settings-tab.on {
  background: var(--sidebar-hover);
  color: var(--contrast-foreground);
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-height: 200px;
}

.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.color-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.color-swatch.on {
  border-color: var(--contrast-foreground);
}

.icon-pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.icon-search {
  height: var(--size-nav-rail);
  padding: 0 var(--space-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  outline: none;
  box-shadow: inset 0 0 0 1px var(--border);
}

.icon-search:focus {
  box-shadow: inset 0 0 0 1px var(--primary);
}

.icon-grid,
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  max-height: 168px;
  overflow-y: auto;
}

.icon-cell,
.emoji-cell {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
}

.icon-cell:hover,
.icon-cell.on,
.emoji-cell:hover,
.emoji-cell.on {
  background: var(--sidebar-hover);
}

.emoji-cell {
  font-size: 18px;
}

.mono-pane {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.mono-input {
  width: 64px;
  height: var(--size-nav-rail);
  text-align: center;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
  font: var(--text-caption-mono) / var(--text-caption-mono--line-height) var(--font-mono);
  font-weight: var(--font-weight-bold);
  outline: none;
  box-shadow: inset 0 0 0 1px var(--border);
  text-transform: uppercase;
}

.mono-preview {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--primary-foreground);
  font: var(--text-caption-mono) / 1 var(--font-mono);
  font-weight: var(--font-weight-bold);
}

.mono-hint {
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.settings-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  padding-block-start: var(--space-xs);
  border-block-start: 1px solid var(--border);
}

.btn {
  padding: var(--space-xxs) var(--space-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
}

.btn:hover {
  background: var(--hover-quiet);
}

.btn.primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn.primary:hover {
  background: var(--primary-active);
}

.btn.auto {
  margin-inline-end: auto;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

/* 比默认弹层窄一档，宽屏下也不会拉成整行 */
@media (min-width: 640px) {
  .settings-dialog {
    max-inline-size: 26rem;
  }
}
</style>
