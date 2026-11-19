<template>
  <nav class="nav" :aria-label="text(LABEL)">
    <section class="group">
      <p class="group-title">{{ text(GUIDE) }}</p>

      <RouterLink
        to="/design/guide"
        class="link"
        :class="{ 'is-active': current === 'guide' }"
        :aria-current="current === 'guide' ? 'page' : undefined"
      >
        DESIGN.md
      </RouterLink>
    </section>

    <section v-for="group in NAV" :key="group.id" class="group">
      <p class="group-title">{{ text(group.title) }}</p>

      <RouterLink
        v-for="item in group.items"
        :key="item.path"
        :to="`/design/${item.path}`"
        class="link"
        :class="{ 'is-active': item.path === current }"
        :aria-current="item.path === current ? 'page' : undefined"
      >
        {{ text(item.title) }}
      </RouterLink>
    </section>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, useRoute } from "vue-router"
import { useGeneralPrefs } from "@features/settings/index.js"
import { NAV, type Label } from "@features/design-lab/lib/nav.js"

const LABEL: Label = { zh: "设计系统页面", en: "Design pages" }
const GUIDE: Label = { zh: "规范", en: "Spec" }
const route = useRoute()
const { locale } = useGeneralPrefs()
const current = computed(() => [route.params.page ?? []].flat().join("/"))

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}
</script>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-xs) var(--space-2xl);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.group-title {
  margin: 0;
  padding: 0 var(--space-xs) var(--space-2xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.link {
  padding: 5px var(--space-xs);
  border-radius: var(--radius-control);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  text-decoration: none;
}

.link:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.link.is-active {
  background: var(--bg-selected);
  color: var(--fg);
  font-weight: var(--font-weight-medium);
}

.link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
