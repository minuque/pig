<template>
  <div class="lab">
    <!-- 页头整体吸顶：品牌、一级分组、全局开关一行，组内页面一行 -->
    <header class="lab-head">
      <div class="lab-bar">
        <h1 class="lab-title">Design</h1>

        <TabsRoot
          :model-value="current.group.id"
          class="lab-groups"
          @update:model-value="openGroup"
        >
          <TabsList size="m" class="lab-tab-list">
            <TabsTrigger v-for="group in groups" :key="group.id" :value="group.id">
              {{ text(group.title) }}
            </TabsTrigger>
          </TabsList>
        </TabsRoot>

        <div class="lab-switches">
          <SegmentedControl :model-value="locale" size="s" @update:model-value="pickLocale">
            <SegmentedControlItem value="zh-CN">中</SegmentedControlItem>
            <SegmentedControlItem value="en">EN</SegmentedControlItem>
          </SegmentedControl>

          <SegmentedControl :model-value="fontSize" size="s" @update:model-value="pickFontSize">
            <SegmentedControlItem v-for="size in FONT_SIZES" :key="size" :value="size">
              {{ size.toUpperCase() }}
            </SegmentedControlItem>
          </SegmentedControl>

          <SegmentedControl
            :model-value="isDark ? 'dark' : 'light'"
            size="s"
            @update:model-value="pickScheme"
          >
            <SegmentedControlItem value="light">Light</SegmentedControlItem>
            <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>

      <TabsRoot
        v-if="current.group.items.length > 1"
        :model-value="current.item.id"
        @update:model-value="(id) => open(String(id))"
      >
        <TabsList size="s" class="lab-tab-list is-sub">
          <TabsTrigger v-for="item in current.group.items" :key="item.id" :value="item.id">
            {{ text(item.title) }}
          </TabsTrigger>
        </TabsList>
      </TabsRoot>
    </header>

    <main class="lab-panel">
      <component :is="current.item.view" :key="current.item.id" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { SegmentedControl, SegmentedControlItem } from "@components/ui/segmented-control/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@components/ui/tabs/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import CardTuner from "@features/design-lab/components/CardTuner.vue"
import TokenOverview from "@features/design-lab/components/TokenOverview.vue"
import { demoGroups, type Label, type NavGroup } from "@features/design-lab/lib/nav.js"

const FONT_SIZES = ["s", "m", "l"] as const
const groups: NavGroup[] = [
  {
    id: "overview",
    title: { zh: "总览", en: "Overview" },
    items: [{ id: "tokens", title: { zh: "设计变量", en: "Tokens" }, view: TokenOverview }],
  },
  {
    id: "tuners",
    title: { zh: "调节", en: "Tuners" },
    items: [{ id: "card-tuner", title: { zh: "卡片", en: "Card" }, view: CardTuner }],
  },
  ...demoGroups(),
]
const route = useRoute()
const router = useRouter()
const { isDark, setScheme } = useColorScheme()
const { fontSize, setFontSize, locale, setLocale } = useGeneralPrefs()
// 当前页记在地址里，刷新后停在原处；找不到时回到总览
const current = computed(() => {
  const id = route.query.page
  const group = groups.find((item) => item.items.some((entry) => entry.id === id)) ?? groups[0]!
  return { group, item: group.items.find((entry) => entry.id === id) ?? group.items[0]! }
})

function open(id: string) {
  void router.replace({ query: { page: id } })
}

function openGroup(id: string | number) {
  const group = groups.find((item) => item.id === id)

  if (group) open(group.items[0]!.id)
}

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}

function pickLocale(next: string) {
  setLocale(next === "en" ? "en" : "zh-CN")
}

function pickScheme(next: string) {
  setScheme(next === "dark" ? "dark" : "light")
}

function pickFontSize(next: string) {
  const size = FONT_SIZES.find((item) => item === next)

  if (size) setFontSize(size)
}

// 设计页不经过启动门，自己撤掉 index.html 里的启动画面
onMounted(() => document.getElementById("startup-splash")?.remove())
</script>

<style scoped>
.lab {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--background);
  color: var(--contrast-foreground);
}

.lab-head {
  position: sticky;
  z-index: 1;
  inset-block-start: 0;
  background: var(--background);
  box-shadow: inset 0 calc(var(--border-width) * -1) 0 var(--border-soft);
}

.lab-bar {
  display: grid;
  grid-template-areas: "title groups switches";
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-lg);
  padding-inline: var(--space-lg);
}

.lab-title {
  grid-area: title;
  margin: 0;
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
}

.lab-groups {
  grid-area: groups;
  min-width: 0;
}

.lab-switches {
  display: flex;
  grid-area: switches;
  gap: var(--space-xs);
}

/* 标签栏底线交给页头统一画；标签多时横向滚动 */
.lab-tab-list {
  overflow-x: auto;
  box-shadow: none;
  scrollbar-width: none;
}

.lab-tab-list.is-sub {
  padding-inline: calc(var(--space-lg) - var(--space-xs));
}

.lab-panel {
  width: min(100%, 1120px);
  margin-inline: auto;
  padding: var(--space-xl) var(--space-lg) var(--space-xxl);
}

/* 窄窗口：标题与开关一行，分组单独一行 */
@media (width < 900px) {
  .lab-bar {
    grid-template-areas:
      "title switches"
      "groups groups";
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0;
    padding-block-start: var(--space-sm);
  }

  /* 一级标签文字左缘与标题对齐：抵掉 rt 标签自带的两层内边距 */
  .lab-groups {
    margin-inline-start: calc(var(--space-md) * -1);
  }
}
</style>
