<template>
  <div class="overview">
    <p class="overview-note">
      <code>style/tokens.css</code>
      +
      <code>style/rt.css</code>
      ·
      {{
        locale === "en" ? "live values, follow theme and font size" : "实时读取，跟随主题与字号档"
      }}
    </p>

    <section v-for="group in groups" :key="group.id" class="group">
      <h2 class="group-title">
        {{ locale === "en" ? group.title.en : group.title.zh }}
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
import { computed, nextTick, onMounted, ref, watch } from "vue"
import rtCss from "@style/rt.css?raw"
import tokensCss from "@style/tokens.css?raw"
import { useColorScheme } from "@features/theme/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import type { Label } from "@features/design-lab/lib/nav.js"

type GroupId =
  | "color-brand"
  | "color-surface"
  | "color-text"
  | "color-interaction"
  | "color-state"
  | "color-code"
  | "color-mark"
  | "color"
  | "text"
  | "leading"
  | "font"
  | "space"
  | "radius"
  | "shadow"
  | "size"
  | "layout"
  | "layer"
  | "material"
  | "motion"
  | "other"

type Token = { name: string; value: string }

const GROUPS: { id: GroupId; title: Label }[] = [
  { id: "color-brand", title: { zh: "颜色 · 主题", en: "Color · Brand" } },
  { id: "color-surface", title: { zh: "颜色 · 表面与边框", en: "Color · Surface & border" } },
  { id: "color-text", title: { zh: "颜色 · 文字", en: "Color · Text" } },
  { id: "color-interaction", title: { zh: "颜色 · 交互", en: "Color · Interaction" } },
  { id: "color-state", title: { zh: "颜色 · 状态", en: "Color · Status" } },
  { id: "color-code", title: { zh: "颜色 · 代码与图表", en: "Color · Code & chart" } },
  { id: "color-mark", title: { zh: "颜色 · 插画与预览", en: "Color · Illustration & preview" } },
  { id: "color", title: { zh: "颜色 · 其他", en: "Color · Other" } },
  { id: "text", title: { zh: "字号", en: "Font size" } },
  { id: "leading", title: { zh: "行高与字距", en: "Line height & tracking" } },
  { id: "font", title: { zh: "字体与字重", en: "Font & weight" } },
  { id: "space", title: { zh: "间距", en: "Spacing" } },
  { id: "radius", title: { zh: "圆角", en: "Radius" } },
  { id: "shadow", title: { zh: "阴影与描边", en: "Shadow & stroke" } },
  { id: "size", title: { zh: "尺寸", en: "Size" } },
  { id: "layout", title: { zh: "布局", en: "Layout" } },
  { id: "layer", title: { zh: "层级", en: "Layers" } },
  { id: "material", title: { zh: "透明度与对比", en: "Opacity & contrast" } },
  { id: "motion", title: { zh: "动效", en: "Motion" } },
  { id: "other", title: { zh: "其他", en: "Other" } },
]
const PREFIX: [RegExp, GroupId][] = [
  [/^--text-.*--/, "leading"],
  [/^--text-/, "text"],
  [/^--(default-)?font-/, "font"],
  [/^--spac(e|ing)/, "space"],
  [/radius/, "radius"],
  [/^--(shadow|divider|focus-ring)/, "shadow"],
  [/^--(size|line-icon|border-width|solar|icon-button|startup-logo)/, "size"],
  [/^--(transcript|header|titlebar|edge-fade|corner)/, "layout"],
  [/^--z-/, "layer"],
  [/^--(opacity|contrast-boost)/, "material"],
  [/^--(duration|ease)/, "motion"],
]
// 颜色按用途细分，按顺序取第一个命中；都不中归「颜色 · 其他」
const COLOR_PREFIX: [RegExp, GroupId][] = [
  [/^--(success|warning|danger|info|state-|scrim)/, "color-state"],
  [/^--(primary|link$)/, "color-brand"],
  [/^--(code|language|inline-code|mermaid)/, "color-code"],
  [/^--(mascot|theme-wire)/, "color-mark"],
  [/^--(btn|fill|scrollbar|effort|minimap|composer-inset)/, "color-interaction"],
  [/foreground|placeholder|^--contrast/, "color-text"],
  [/^--(background|card|surface|sidebar|popover|inverse|border|white)/, "color-surface"],
]
// 有可视样例的分组；其余只列名字和值
const VISUAL = new Set<GroupId>(["color", "text", "font", "space", "radius", "shadow", "size"])
// 只收根作用域里的声明：.dark 与字号档是同名覆盖，不另列
const NAMES = [...new Set([...declared(tokensCss), ...declared(rtCss)])]
const { isDark } = useColorScheme()
const { fontSize, locale } = useGeneralPrefs()
const values = ref<Token[]>([])
const groups = computed(() =>
  GROUPS.map((group) => ({
    ...group,
    kind: group.id.startsWith("color") ? ("color" as const) : group.id,
    tokens: values.value.filter((token) => groupOf(token) === group.id),
  })).filter((group) => group.tokens.length > 0),
)

function declared(css: string): string[] {
  const blocks = css.match(/(?::root|\.radix-themes)\s*\{[^}]*\}/g) ?? []
  return blocks.flatMap((block) =>
    [...block.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]!),
  )
}

function groupOf(token: Token): GroupId {
  const hit = PREFIX.find(([pattern]) => pattern.test(token.name))

  if (hit) return hit[1]

  if (!CSS.supports("color", token.value)) return "other"
  return COLOR_PREFIX.find(([pattern]) => pattern.test(token.name))?.[1] ?? "color"
}

function read() {
  const root = document.querySelector("[data-is-root-theme]") ?? document.documentElement
  const style = getComputedStyle(root)
  values.value = NAMES.map((name) => ({ name, value: style.getPropertyValue(name).trim() })).filter(
    (token) => token.value !== "",
  )
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

onMounted(read)

watch([isDark, fontSize], () => nextTick(read))
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxl);
}

.overview-note {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
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
  color: var(--contrast-foreground-faint);
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
  box-shadow: 0 0 0 var(--border-width) var(--border-soft);
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
  box-shadow: inset 0 0 0 var(--border-width) var(--border-soft);
}

.sample:is([data-kind="radius"], [data-kind="shadow"]) {
  width: 56px;
  height: 40px;
  border: var(--border-width) solid var(--border);
  background: var(--surface);
}

.sample[data-kind="shadow"] {
  border: 0;
}

.sample:is([data-kind="space"], [data-kind="size"]) {
  min-height: 12px;
  height: 12px;
  border-radius: calc(var(--radius-control) / 2);
  background: var(--primary);
}

.token-name,
.token-value {
  overflow: hidden;
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-name {
  color: var(--contrast-foreground);
  font-size: var(--text-meta);
}

.token-value {
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}
</style>
