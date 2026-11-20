<template>
  <div class="overview">
    <div v-if="all.length > 12" class="filter">
      <TextFieldRoot
        v-model="query"
        size="s"
        class="filter-field"
        :placeholder="text(PLACEHOLDER)"
        :aria-label="text(PLACEHOLDER)"
      >
        <TextFieldSlot side="left"><SearchIcon class="size-icon-sm" /></TextFieldSlot>
      </TextFieldRoot>

      <span class="filter-count">{{ filtered.length }} / {{ all.length }}</span>
    </div>

    <p v-if="!groups.length" class="empty">{{ text(EMPTY) }}</p>

    <section v-for="group in groups" :key="group.id" class="group">
      <h2 class="group-title">
        {{ text(groupTitle(group.id)) }}
        <span class="group-count">{{ group.tokens.length }}</span>
      </h2>

      <CardList>
        <CardRow
          v-for="token in group.tokens"
          :key="token.name"
          class="token"
          :data-wide="isWide(token) || undefined"
        >
          <span class="sample" :data-kind="kindOf(token)">
            <span
              v-if="kindOf(token) === 'fill' || kindOf(token) === 'paint'"
              class="swatch"
              :style="{ background: css(token) }"
            />

            <span
              v-else-if="kindOf(token) === 'border'"
              class="ring"
              :style="{ borderColor: css(token) }"
            />

            <span
              v-else-if="kindOf(token) === 'fg'"
              class="glyph"
              :style="{ background: ground(token) }"
            >
              <span :style="{ color: css(token) }">Aa</span>
            </span>

            <span
              v-else-if="kindOf(token) === 'text'"
              class="type"
              :style="{ fontSize: css(token) }"
            >
              界面 Aa 123
            </span>

            <span
              v-else-if="kindOf(token) === 'leading'"
              class="leading"
              :style="{ lineHeight: css(token) }"
            >
              界面 Aa
              <br />
              界面 Aa
            </span>

            <span
              v-else-if="kindOf(token) === 'tracking'"
              class="type"
              :style="{ letterSpacing: css(token) }"
            >
              界面 Aa
            </span>

            <span v-else-if="kindOf(token) === 'font'" class="type" :style="fontStyle(token)">
              工作台 Workbench
            </span>

            <span
              v-else-if="kindOf(token) === 'space' || kindOf(token) === 'size'"
              class="bar"
              :style="{ inlineSize: `min(${css(token)}, 100%)` }"
            />

            <span
              v-else-if="kindOf(token) === 'radius'"
              class="corner"
              :style="{ borderStartStartRadius: css(token) }"
            />

            <span
              v-else-if="kindOf(token) === 'shadow'"
              class="lift"
              :style="{ boxShadow: css(token) }"
            />

            <span
              v-else-if="kindOf(token) === 'width'"
              class="rule"
              :style="{ blockSize: css(token) }"
            />

            <span
              v-else-if="kindOf(token) === 'opacity'"
              class="glyph"
              :style="{ opacity: css(token) }"
            >
              Aa
            </span>

            <svg v-else-if="kindOf(token) === 'ease'" class="curve" viewBox="0 0 48 28">
              <path class="axis" d="M4 24 H44" />
              <path :d="easePath(token.value)" />
            </svg>

            <span v-else-if="kindOf(token) === 'layer'" class="stack">
              <span />
              <span />
              <span />
            </span>
          </span>

          <code class="name">
            <span class="dash">--</span>
            {{ token.name.slice(2) }}
          </code>

          <span class="value">{{ token.value }}</span>
        </CardRow>
      </CardList>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { SearchIcon } from "@components/icons/index.js"
import { CardList, CardRow } from "@components/ui/card/index.js"
import { TextFieldRoot, TextFieldSlot } from "@components/ui/text-field/index.js"
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
const query = ref("")
const PLACEHOLDER: Label = { zh: "筛选名称或值", en: "Filter name or value" }
const EMPTY: Label = { zh: "没有匹配的变量", en: "No matching tokens" }
const WIDE: Kind[] = ["text", "leading", "tracking", "font"]
const GROUND: Record<string, string> = {
  "--fg-on-accent": "var(--accent-solid)",
  "--fg-inverse": "var(--bg-inverse)",
}
const all = computed(() => tokens.value.filter(props.category.match))
const filtered = computed(() => {
  const term = query.value.trim().toLowerCase()

  if (!term) return all.value
  return all.value.filter(
    (token) => token.name.toLowerCase().includes(term) || token.value.toLowerCase().includes(term),
  )
})
const groups = computed(() => {
  const byGroup = new Map<string, Token[]>()

  for (const token of filtered.value)
    byGroup.set(token.group, [...(byGroup.get(token.group) ?? []), token])
  return [...byGroup].map(([id, list]) => ({ id, tokens: list }))
})

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}

function css(token: Token): string {
  return `var(${token.name})`
}

function isWide(token: Token): boolean {
  return WIDE.includes(kindOf(token))
}

function ground(token: Token): string | undefined {
  return GROUND[token.name]
}

function fontStyle(token: Token): Record<string, string> {
  return token.name.includes("weight") ? { fontWeight: css(token) } : { fontFamily: css(token) }
}

function easePath(value: string): string {
  const match = /cubic-bezier\(\s*([\d.-]+),\s*([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)\s*\)/.exec(value)

  if (!match) return "M4 24 C 16 24, 28 4, 44 4"

  const [x1, y1, x2, y2] = match.slice(1).map(Number) as [number, number, number, number]
  const x = (n: number) => (4 + n * 40).toFixed(1)
  const y = (n: number) => (24 - n * 20).toFixed(1)
  return `M4 24 C ${x(x1)} ${y(y1)} ${x(x2)} ${y(y2)} 44 4`
}
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
}

.filter {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.filter-field {
  inline-size: min(240px, 100%);
}

.filter-count {
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.empty {
  margin: 0;
  padding-block: var(--space-2xl);
  color: var(--fg-secondary);
  text-align: center;
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
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
  font-variant-numeric: tabular-nums;
}

.token {
  display: grid;
  grid-template-areas:
    "sample name"
    "sample value";
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  column-gap: var(--space-sm);
  row-gap: 1px;
  padding-block: var(--space-xs);
}

.token[data-wide] {
  grid-template-columns: min(38%, 152px) minmax(0, 1fr);
}

@media (width >= 720px) {
  .token {
    grid-template-areas: "sample name value";
    grid-template-columns: 56px minmax(180px, 240px) minmax(0, 1fr);
  }

  .token[data-wide] {
    grid-template-columns: min(24%, 152px) minmax(180px, 240px) minmax(0, 1fr);
  }
}

.sample {
  display: flex;
  grid-area: sample;
  min-inline-size: 0;
  align-items: center;
  color: var(--fg-secondary);
}

.swatch,
.ring,
.lift,
.glyph {
  flex: none;
  inline-size: 40px;
  block-size: 24px;
  border-radius: var(--radius-control);
}

.swatch {
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.ring {
  border: var(--border-width) solid var(--fg);
  background: var(--bg-surface);
}

.glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.lift {
  inline-size: 48px;
  block-size: 32px;
  background: var(--bg);
  outline: var(--border-width) solid var(--border);
}

.type,
.leading {
  overflow: hidden;
  color: var(--fg);
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leading {
  font-size: var(--text-meta);
  white-space: normal;
}

.bar {
  flex: none;
  block-size: 10px;
  border-radius: calc(var(--radius-control) / 2);
  background: var(--bg-emphasis);
}

.corner {
  flex: none;
  inline-size: 32px;
  block-size: 24px;
  border-block-start: var(--border-width) solid currentColor;
  border-inline-start: var(--border-width) solid currentColor;
}

.rule {
  flex: none;
  inline-size: 32px;
  min-block-size: var(--border-width);
  background: var(--fg-secondary);
}

.curve {
  inline-size: 40px;
  block-size: 28px;
  fill: none;
  stroke: var(--fg-secondary);
  stroke-width: var(--icon-stroke);
}

.curve .axis {
  stroke: var(--border);
}

.stack {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 2px;
  inline-size: 32px;
}

.stack span {
  block-size: 3px;
  border-radius: 1px;
  background: var(--bg-emphasis);
}

.stack span:last-child {
  background: var(--fg-secondary);
}

.name,
.value {
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.name {
  grid-area: name;
  color: var(--fg);
  font-size: var(--text-code);
}

.dash {
  color: var(--fg-secondary);
}

.value {
  grid-area: value;
  color: var(--fg-secondary);
}
</style>
