<template>
  <div class="lab">
    <!-- 页头吸顶：标题回总览、当前位置、全局开关 -->
    <header class="lab-bar">
      <nav class="lab-crumbs">
        <RouterLink to="/design" class="lab-home">Design</RouterLink>

        <template v-if="current">
          <span class="lab-sep">/</span>
          <span>{{ text(current.group.title) }}</span>
          <span class="lab-sep">/</span>
          <span class="lab-here">{{ text(current.item.title) }}</span>
        </template>

        <template v-else-if="isGuide">
          <span class="lab-sep">/</span>
          <span class="lab-here">DESIGN.md</span>
        </template>
      </nav>

      <div class="lab-switches">
        <Button :as="RouterLink" to="/design/guide" variant="soft" color="gray" size="s">
          <FileTextIcon class="size-icon-xs" />
          DESIGN.md
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

    <main class="lab-panel">
      <template v-if="current">
        <h1 class="lab-title">{{ text(current.item.title) }}</h1>
        <component :is="current.item.view" :key="current.item.path" />

        <nav class="lab-pager">
          <RouterLink v-if="current.prev" :to="`/design/${current.prev.path}`" class="lab-step">
            <ChevronLeftIcon class="size-icon-xs" />
            {{ text(current.prev.title) }}
          </RouterLink>

          <RouterLink
            v-if="current.next"
            :to="`/design/${current.next.path}`"
            class="lab-step is-next"
          >
            {{ text(current.next.title) }}
            <ChevronRightIcon class="size-icon-xs" />
          </RouterLink>
        </nav>
      </template>

      <DesignGuide v-else-if="isGuide" />
      <DesignHome v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue"
import { RouterLink, useRoute } from "vue-router"
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@components/ui/tabs/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import DesignGuide from "@features/design-lab/components/DesignGuide.vue"
import DesignHome from "@features/design-lab/components/DesignHome.vue"
import { NAV, type Label } from "@features/design-lab/lib/nav.js"

const PAGES = NAV.flatMap((group) => group.items.map((item) => ({ group, item })))
const route = useRoute()
const { isDark, setScheme } = useColorScheme()
const { locale, setLocale } = useGeneralPrefs()
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
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.lab-bar {
  position: sticky;
  z-index: 1;
  inset-block-start: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  block-size: var(--header-height);
  padding-inline: var(--space-lg);
  background: var(--bg);
  box-shadow: inset 0 calc(var(--border-width) * -1) 0 var(--border-subtle);
}

.lab-crumbs {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  min-width: 0;
  overflow: hidden;
  color: var(--fg-secondary);
  white-space: nowrap;
}

.lab-home {
  color: var(--fg);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.lab-sep {
  color: var(--fg-faint);
}

.lab-here {
  color: var(--fg);
}

.lab-switches {
  display: flex;
  gap: var(--space-xs);
}

.lab-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  width: min(100%, 1120px);
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
  color: var(--fg-secondary);
  text-decoration: none;
}

.lab-step:hover {
  color: var(--fg);
}

.lab-step.is-next {
  margin-inline-start: auto;
}
</style>
