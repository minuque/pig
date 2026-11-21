<template>
  <div class="lab">
    <!-- 页头吸顶：标题回总览、当前位置、全局开关 -->
    <header class="lab-bar">
      <nav class="lab-crumbs">
        <RouterLink to="/design" class="lab-home">Design</RouterLink>

        <template v-if="current">
          <span class="lab-sep">/</span>
          <span class="lab-group">{{ text(current.group.title) }}</span>
          <span class="lab-sep">/</span>
          <span class="lab-here">{{ text(current.item.title) }}</span>
        </template>

        <template v-else-if="isGuide">
          <span class="lab-sep">/</span>
          <span class="lab-here">DESIGN.md</span>
        </template>
      </nav>

      <div class="lab-switches">
        <Button
          size="s"
          variant="ghost"
          color="neutral"
          :aria-label="text(SEARCH_PAGE)"
          @click="search?.open()"
        >
          <SearchIcon class="size-icon-sm" />
          <span class="lab-optional">{{ text(SEARCH) }}</span>
        </Button>

        <Button
          :as="RouterLink"
          to="/design/guide"
          variant="secondary"
          color="neutral"
          size="s"
          aria-label="DESIGN.md 规范"
        >
          <FileTextIcon class="size-icon-sm" />
          <span class="lab-optional">DESIGN.md</span>
        </Button>

        <TabsRoot :model-value="locale" @update:model-value="(v) => pickLocale(String(v))">
          <TabsList variant="segmented" size="s">
            <TabsTrigger value="zh-CN">中</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
          </TabsList>
        </TabsRoot>

        <TabsRoot
          :model-value="isDark ? 'dark' : 'light'"
          @update:model-value="(v) => pickScheme(String(v))"
        >
          <TabsList variant="segmented" size="s">
            <TabsTrigger value="light">Light</TabsTrigger>
            <TabsTrigger value="dark">Dark</TabsTrigger>
          </TabsList>
        </TabsRoot>
      </div>
    </header>

    <div class="lab-body">
      <aside class="lab-nav">
        <ScrollArea scrollbars="vertical" class="lab-nav-scroll">
          <DesignNav />
        </ScrollArea>
      </aside>

      <main class="lab-panel">
        <template v-if="current">
          <h1 class="lab-title">{{ text(current.item.title) }}</h1>
          <component :is="current.item.view" :key="current.item.path" />

          <nav class="lab-pager">
            <RouterLink v-if="current.prev" :to="`/design/${current.prev.path}`" class="lab-step">
              <ChevronLeftIcon class="size-icon-sm" />
              {{ text(current.prev.title) }}
            </RouterLink>

            <RouterLink
              v-if="current.next"
              :to="`/design/${current.next.path}`"
              class="lab-step is-next"
            >
              {{ text(current.next.title) }}
              <ChevronRightIcon class="size-icon-sm" />
            </RouterLink>
          </nav>
        </template>

        <DesignGuide v-else-if="isGuide" />
        <DesignHome v-else />
      </main>
    </div>

    <DesignSearch ref="search" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from "vue"
import { RouterLink, useRoute } from "vue-router"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  SearchIcon,
} from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { ScrollArea } from "@components/ui/scroll-area/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@components/ui/tabs/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import DesignGuide from "@features/design-lab/components/DesignGuide.vue"
import DesignHome from "@features/design-lab/components/DesignHome.vue"
import DesignNav from "@features/design-lab/components/DesignNav.vue"
import DesignSearch from "@features/design-lab/components/DesignSearch.vue"
import { NAV, type Label } from "@features/design-lab/lib/nav.js"

const PAGES = NAV.flatMap((group) => group.items.map((item) => ({ group, item })))
const SEARCH: Label = { zh: "搜索", en: "Search" }
const SEARCH_PAGE: Label = { zh: "搜索页面", en: "Search pages" }
const route = useRoute()
const { isDark, setScheme } = useColorScheme()
const { locale, setLocale } = useGeneralPrefs()
const search = useTemplateRef<{ open: () => void }>("search")
const path = computed(() => [route.params.page ?? []].flat().join("/"))
// 设计规范文档不进翻页顺序，单独一页
const isGuide = computed(() => path.value === "guide")
// 地址段对上某页就显示该页，对不上回总览
const current = computed(() => {
  const index = PAGES.findIndex((page) => page.item.path === path.value)

  if (index < 0) return null
  return { ...PAGES[index]!, prev: PAGES[index - 1]?.item, next: PAGES[index + 1]?.item }
})

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}

function pickLocale(next: string) {
  setLocale(next === "en" ? "en" : "zh-CN")
}

function pickScheme(next: string) {
  setScheme(next === "dark" ? "dark" : "light")
}

watch(
  () => route.path,
  () => window.scrollTo(0, 0),
)

// 设计页不经过启动门，自己撤掉 index.html 里的启动画面
onMounted(() => document.getElementById("startup-splash")?.remove())
</script>

<style scoped>
.lab {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  background: var(--bg);
  color: var(--fg);
}

.lab-bar {
  position: sticky;
  z-index: var(--z-sticky);
  inset-block-start: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs) var(--space-lg);
  min-block-size: var(--header-height);
  padding: var(--space-2xs) var(--space-lg);
  background: var(--bg);
}

.lab-crumbs {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: baseline;
  gap: var(--space-xs);
  overflow: hidden;
  color: var(--fg-secondary);
  white-space: nowrap;
}

.lab-home {
  flex: none;
  color: var(--fg);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.lab-home:hover {
  color: var(--accent-text);
}

.lab-sep {
  flex: none;
  color: var(--fg-muted);
}

.lab-group,
.lab-here {
  overflow: hidden;
  text-overflow: ellipsis;
}

.lab-here {
  color: var(--fg);
}

.lab-switches {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xs);
  margin-inline-start: auto;
}

.lab-body {
  display: grid;
  flex: 1;
  grid-template-columns: 216px minmax(0, 1fr);
  align-items: start;
  padding: var(--space-xs) 0 0 var(--space-xs);
}

/* 侧栏是浮在页头下方的粘性面板：四周留一档缝，内容在面板里自己滚 */
.lab-nav {
  position: sticky;
  inset-block-start: calc(var(--header-height) + var(--space-xs));
  block-size: calc(100dvh - var(--header-height) - var(--space-xs) * 2);
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--sidebar);
  box-shadow: 0 0 0 var(--border-width) var(--border);
}

/* Reka 的 ScrollArea 根带行内 position: relative，吸顶交给外层 aside，这里只填满 */
.lab-nav-scroll {
  block-size: 100%;
}

.lab-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  width: 100%;
  max-inline-size: 1120px;
  margin-inline: auto;
  padding: var(--space-xl) var(--space-lg) var(--space-2xl);
}

.lab-title {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--text-heading--letter-spacing);
  line-height: var(--text-heading--line-height);
}

.lab-pager {
  display: flex;
  justify-content: space-between;
  padding-block-start: var(--space-lg);
  box-shadow: var(--separator-top);
}

.lab-step {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  color: var(--fg-secondary);
  text-decoration: none;
}

.lab-step:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.lab-step.is-next {
  margin-inline-start: auto;
}

.lab-optional {
  display: none;
}

@media (width >= 720px) {
  .lab-optional {
    display: inline;
  }
}

@media (width < 960px) {
  .lab-body {
    display: block;
    padding: 0;
  }

  .lab-nav {
    display: none;
  }
}
</style>
