<template>
  <div class="overview">
    <section v-for="group in groups" :key="group.id" class="group">
      <h2 class="group-title">
        {{ text(groupTitle(group.id)) }}
        <span class="group-count">{{ group.tokens.length }}</span>
      </h2>

      <div class="grid" :data-wide="group.tokens.some(isWide) || undefined">
        <div v-for="token in group.tokens" :key="token.name" class="token" :title="token.value">
          <div
            v-if="kindOf(token) !== 'none'"
            class="sample"
            :data-kind="kindOf(token)"
            :style="sampleStyle(token)"
          >
            <template v-if="kindOf(token) === 'text'">界面 Aa 123</template>
            <template v-else-if="kindOf(token) === 'font'">{{ fontSample(token.name) }}</template>
          </div>

          <div class="token-name">{{ token.name }}</div>
          <div class="token-value">{{ token.value }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useGeneralPrefs } from "@features/settings/index.js"
import type { Label } from "@features/design-lab/lib/nav.js"
import {
  groupTitle,
  kindOf,
  useTokens,
  type Category,
  type Kind,
  type Token,
} from "@features/design-lab/lib/tokens.js"

const props = defineProps<{ category: Category }>()
const { locale } = useGeneralPrefs()
const tokens = useTokens()
// 按 tokens.css 里的出现顺序分组
const groups = computed(() => {
  const byGroup = new Map<string, Token[]>()

  for (const token of tokens.value.filter(props.category.match))
    byGroup.set(token.group, [...(byGroup.get(token.group) ?? []), token])
  return [...byGroup].map(([id, list]) => ({ id, tokens: list }))
})

// 字号、字体、间距、尺寸的样例是横条或一行字，给宽列
function isWide(token: Token): boolean {
  return ["text", "font", "space", "size"].includes(kindOf(token))
}

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}

function sampleStyle(token: Token): Record<string, string> {
  const ref = `var(${token.name})`
  const styles: Partial<Record<Kind, Record<string, string>>> = {
    color: { background: ref },
    text: { fontSize: ref },
    font: token.name.includes("weight") ? { fontWeight: ref } : { fontFamily: ref },
    space: { width: ref },
    radius: { borderRadius: ref },
    shadow: { boxShadow: ref },
    size: { width: `min(${ref}, 100%)` },
  }
  return styles[kindOf(token)] ?? {}
}

function fontSample(name: string): string {
  return name.includes("mono") ? "const pig = 1" : "工作台 Workbench"
}
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.group-title {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin: 0;
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
}

.group-count {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-sm);
}

.grid[data-wide] {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.token {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
  padding: var(--space-sm);
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 var(--border-width) var(--border-subtle);
}

.sample {
  display: flex;
  align-items: center;
  min-height: 40px;
  margin-block-end: var(--space-2xs);
  overflow: hidden;
  white-space: nowrap;
}

.sample[data-kind="color"] {
  border-radius: var(--radius-control);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
}

.sample:is([data-kind="radius"], [data-kind="shadow"]) {
  width: 56px;
  height: 40px;
  border: var(--border-width) solid var(--border);
  background: var(--bg-surface);
}

.sample[data-kind="shadow"] {
  border: 0;
}

.sample:is([data-kind="space"], [data-kind="size"]) {
  min-height: 12px;
  height: 12px;
  border-radius: calc(var(--radius-control) / 2);
  background: var(--accent-solid);
}

.token-name,
.token-value {
  overflow: hidden;
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-name {
  color: var(--fg);
  font-size: var(--text-meta);
}

.token-value {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}
</style>
