<template>
  <div class="home">
    <header class="home-head">
      <h1 class="home-title">Design System</h1>

      <p class="home-lead">
        {{
          text({
            zh: "pig 每个界面背后的设计变量与基础组件，数值实时读取、跟随主题。",
            en: "The tokens and primitives behind every pig screen, read live from the theme.",
          })
        }}
      </p>

      <p class="home-stats">
        {{
          text({
            zh: `${tokens.length} 个变量 · ${PAGES} 个页面`,
            en: `${tokens.length} tokens · ${PAGES} pages`,
          })
        }}
      </p>
    </header>

    <div class="tiles">
      <Card v-for="category in CATEGORIES" :key="category.id" as-child class="tile">
        <RouterLink :to="`/design/tokens/${category.id}`">
          <TokenPreview :category="category.id" />

          <span class="tile-foot">
            <span class="tile-name">{{ text(category.title) }}</span>
            <span class="tile-count">{{ counts[category.id] }}</span>
          </span>
        </RouterLink>
      </Card>
    </div>

    <section v-for="group in sections" :key="group.id" class="section">
      <h2 class="section-title">{{ text(group.title) }}</h2>

      <Card class="rows">
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          :to="`/design/${item.path}`"
          class="row"
        >
          {{ text(item.title) }}
          <ChevronRightIcon class="row-icon size-icon-sm" />
        </RouterLink>
      </Card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { RouterLink } from "vue-router"
import { ChevronRightIcon } from "@components/icons/index.js"
import { Card } from "@components/ui/card/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import TokenPreview from "@features/design-lab/components/TokenPreview.vue"
import { NAV, type Label } from "@features/design-lab/lib/nav.js"
import { CATEGORIES, useTokens } from "@features/design-lab/lib/tokens.js"

const { locale } = useGeneralPrefs()
const tokens = useTokens()
const PAGES = NAV.reduce((total, group) => total + group.items.length, 0)
const sections = NAV.filter((group) => group.id !== "tokens")
const counts = computed(() =>
  Object.fromEntries(
    CATEGORIES.map((category) => [category.id, tokens.value.filter(category.match).length]),
  ),
)

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.home-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.home-stats {
  margin: 0;
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.home-title {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--text-heading--letter-spacing);
  line-height: var(--text-heading--line-height);
}

.home-lead {
  margin: 0;
  color: var(--fg-secondary);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(max(240px, calc((100% - 2 * var(--space-md)) / 3)), 1fr)
  );
  gap: var(--space-md);
}

.tile[data-slot="card"] {
  display: flex;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.tile[data-slot="card"]:hover {
  background: var(--bg-hover);
}

.tile-foot {
  display: flex;
  justify-content: space-between;
  padding-block-start: var(--space-sm);
  box-shadow: var(--separator-top);
}

.tile-name {
  font-weight: var(--font-weight-medium);
}

.tile-count,
.section-title {
  color: var(--fg-secondary);
}

.tile-count {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.section {
  display: none;
  flex-direction: column;
  gap: var(--space-sm);
}

@media (width < 960px) {
  .section {
    display: flex;
  }
}

.section-title {
  margin: 0;
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.rows[data-slot="card"] {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(max(280px, calc((100% - var(--space-lg)) / 2)), 1fr)
  );
  column-gap: var(--space-lg);
  padding: var(--space-xs);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-control);
  color: var(--fg);
  text-decoration: none;
}

.row:hover {
  background: var(--bg-hover);
}

.row:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.row-icon {
  color: var(--fg-secondary);
}
</style>
