<template>
  <div class="overview">
    <section v-for="group in groups" :key="group.id" class="group">
      <h2 class="group-title">
        {{ text(group.title) }}
        <span class="group-count">{{ group.tokens.length }}</span>
      </h2>

      <div class="grid" :data-kind="group.kind">
        <div v-for="token in group.tokens" :key="token.name" class="token" :title="token.value">
          <div
            v-if="VISUAL.has(group.kind)"
            class="sample"
            :data-kind="group.kind"
            :style="sampleStyle(group.kind, token.name)"
          >
            <template v-if="group.id === 'text'">界面 Aa 123</template>
            <template v-else-if="group.id === 'font'">{{ fontSample(token.name) }}</template>
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
  GROUP_TITLES,
  groupOf,
  useTokens,
  type Category,
  type GroupId,
} from "@features/design-lab/lib/tokens.js"

const props = defineProps<{ category: Category }>()
// 有可视样例的分组；其余只列名字和值
const VISUAL = new Set<GroupId>(["color", "text", "font", "space", "radius", "shadow", "size"])
const { locale } = useGeneralPrefs()
const tokens = useTokens()
const groups = computed(() =>
  props.category.groups
    .map((id) => ({
      id,
      title: GROUP_TITLES[id],
      kind: id.startsWith("color") ? ("color" as const) : id,
      tokens: tokens.value.filter((token) => groupOf(token) === id),
    }))
    .filter((group) => group.tokens.length > 0),
)

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}

function sampleStyle(group: GroupId, name: string): Record<string, string> {
  const ref = `var(${name})`
  const styles: Partial<Record<GroupId, Record<string, string>>> = {
    color: { background: ref },
    text: { fontSize: ref },
    font: name.includes("weight") ? { fontWeight: ref } : { fontFamily: ref },
    space: { width: ref },
    radius: { borderRadius: ref },
    shadow: { boxShadow: ref },
    size: { width: `min(${ref}, 100%)` },
  }
  return styles[group] ?? {}
}

function fontSample(name: string): string {
  return name.includes("mono") ? "const pig = 1" : "工作台 Workbench"
}
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxl);
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
  color: var(--fg-faint);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-sm);
}

.grid:is([data-kind="text"], [data-kind="font"], [data-kind="space"], [data-kind="size"]) {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.token {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  min-width: 0;
  padding: var(--space-sm);
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 var(--border-width) var(--border-subtle);
}

.sample {
  display: flex;
  align-items: center;
  min-height: 40px;
  margin-block-end: var(--space-xxs);
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
  color: var(--fg-faint);
  font-size: var(--text-meta);
}
</style>
