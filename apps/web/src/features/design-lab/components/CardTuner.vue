<template>
  <div class="tuner">
    <section class="tuner-preview" :style="previewVars">
      <CardList>
        <CardRow v-for="row in SETTINGS_ROWS" :key="row" class="demo-row">
          <span>{{ row }}</span>
          <Switch :model-value="true" size="s" />
        </CardRow>
      </CardList>

      <MarkdownContent :nodes="nodes" />

      <Banner variant="surface" size="s" color="danger">
        <template #icon><CircleExclamationPointIcon /></template>
        <template #title>出错了</template>
        Banner 的边框不读卡片变量，放在这里作对照。
      </Banner>
    </section>

    <section class="tuner-panel">
      <div class="tuner-presets">
        <Button
          v-for="preset in PRESETS"
          :key="preset.name"
          size="s"
          :variant="isPreset(preset) ? 'secondary' : 'outline'"
          color="neutral"
          @click="apply(preset)"
        >
          {{ preset.name }}
        </Button>
      </div>

      <div class="tuner-field">
        <span class="tuner-label">外环颜色 --border</span>

        <TabsRoot v-model="value.border">
          <TabsList variant="segmented" size="s">
            <TabsTrigger v-for="step in STEPS" :key="step" :value="step">
              {{ step.replace("--border-", "").replace("--", "") }}
            </TabsTrigger>
          </TabsList>
        </TabsRoot>
      </div>

      <div class="tuner-field">
        <span class="tuner-label">行间分隔 --border-subtle</span>

        <TabsRoot v-model="value.divider">
          <TabsList variant="segmented" size="s">
            <TabsTrigger v-for="step in STEPS" :key="step" :value="step">
              {{ step.replace("--border-", "").replace("--", "") }}
            </TabsTrigger>
          </TabsList>
        </TabsRoot>
      </div>

      <div class="tuner-field">
        <span class="tuner-label">
          圆角 --radius-card
          <span class="tuner-value">{{ value.radius }}px</span>
        </span>

        <Slider v-model="radius" :min="4" :max="16" :step="1" size="s" />
      </div>

      <div class="tuner-field">
        <span class="tuner-label">底色 --card-surface</span>

        <TabsRoot v-model="value.surface">
          <TabsList variant="segmented" size="s">
            <TabsTrigger v-for="(_, key) in SURFACES" :key="key" :value="key">
              {{ key }}
            </TabsTrigger>
          </TabsList>
        </TabsRoot>
      </div>

      <div class="tuner-output">
        <div class="tuner-output-head">
          <span class="tuner-label">粘回 tokens.css</span>

          <Button size="s" variant="ghost" color="neutral" @click="copy">
            {{ copied ? "已复制" : "复制" }}
          </Button>
        </div>

        <pre class="tuner-code">{{ output }}</pre>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from "vue"
import { useClipboard } from "@vueuse/core"
import { Button } from "@components/ui/button/index.js"
import { Banner } from "@components/ui/banner/index.js"
import { CardList, CardRow } from "@components/ui/card/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@components/ui/tabs/index.js"
import { Slider } from "@components/ui/slider/index.js"
import { Switch } from "@components/ui/switch/index.js"
import { CircleExclamationPointIcon } from "@components/icons/index.js"
import tokensCss from "@style/tokens.css?raw"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import { useColorScheme } from "@features/theme/index.js"

type Values = { border: string; divider: string; radius: number; surface: string }

const STEPS = ["--border-subtle", "--border", "--border-strong", "--border-input"]
const SURFACES: Record<string, string> = {
  none: "transparent",
  a2: "var(--bg-muted)",
  surface: "var(--bg-surface)",
}
const CURRENT: Values = {
  border: "--border",
  divider: "--border-subtle",
  radius: Number(declared(tokensCss, "--radius-card", /([\d.]+)px/) ?? 8),
  surface: declared(tokensCss, "--card-surface", /(transparent)/) ? "none" : "surface",
}
const PRESETS: (Values & { name: string })[] = [
  { name: "当前", ...CURRENT },
  {
    name: "更淡",
    ...CURRENT,
    border: step(CURRENT.border, -1),
    divider: step(CURRENT.divider, -1),
  },
  {
    name: "更清晰",
    ...CURRENT,
    border: step(CURRENT.border, 1),
    divider: step(CURRENT.divider, 1),
  },
  { name: "浅底", ...CURRENT, surface: "a2" },
]
const SETTINGS_ROWS = ["发送后自动滚动", "完成时播放提示音", "显示思考过程"]
const SAMPLE = [
  "行内码 `pnpm check:touched` 跑完再提交，`--radius-card` 控制圆角。",
  "",
  "```ts",
  'const card = { ring: "--border", radius: "--radius-card" }',
  "export default card",
  "```",
  "",
  "| 变量 | 用途 |",
  "| --- | --- |",
  "| `--border` | 卡片外环 |",
  "| `--border-subtle` | 行间分隔 |",
].join("\n")
const nodes = useMarkdownNodes({
  text: () => SAMPLE,
  streaming: () => false,
  cacheKey: () => "design-tuner",
})
const value = reactive<Values>({ ...PRESETS[0]! })
const { isDark } = useColorScheme()
const steps = shallowRef<Record<string, string>>({})

watch(
  isDark,
  () => {
    const root = getComputedStyle(document.documentElement)
    steps.value = Object.fromEntries(
      STEPS.map((name) => [name, root.getPropertyValue(name).trim()]),
    )
  },
  { flush: "post", immediate: true },
)

const neutral = (step: string) => steps.value[step] ?? ""
const radius = computed({
  get: () => [value.radius],
  set: ([next]) => (value.radius = next ?? value.radius),
})
const previewVars = computed(() => ({
  "--border": neutral(value.border),
  "--border-subtle": neutral(value.divider),
  "--separator-top": `inset 0 var(--border-width) 0 ${neutral(value.divider)}`,
  "--radius-card": `${value.radius}px`,
  "--card-surface": SURFACES[value.surface],
}))
const output = computed(() =>
  [
    `/* style/tokens.css → ${isDark.value ? "html.dark" : ":root"} */`,
    `--border: ${neutral(value.border)};`,
    `--border-subtle: ${neutral(value.divider)};`,
    "",
    "/* style/tokens.css → :root */",
    `--card-surface: ${SURFACES[value.surface]};`,
    "",
    "/* style/tokens.css → :root */",
    `--radius-card: ${value.radius}px;`,
  ].join("\n"),
)
const copied = ref(false)
const { copy: write } = useClipboard({ legacy: true })

function declared(css: string, name: string, pick: RegExp): string | undefined {
  const line = new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`).exec(css)?.[1]
  return line ? pick.exec(line)?.[1] : undefined
}

function step(current: string, by: number): string {
  const index = STEPS.indexOf(current) + by
  return STEPS[Math.min(Math.max(index, 0), STEPS.length - 1)]!
}

function isPreset(preset: Values): boolean {
  return (["border", "divider", "radius", "surface"] as const).every(
    (key) => preset[key] === value[key],
  )
}

function apply(preset: Values) {
  Object.assign(value, {
    border: preset.border,
    divider: preset.divider,
    radius: preset.radius,
    surface: preset.surface,
  })
}

async function copy() {
  await write(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<style scoped>
.tuner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  align-items: start;
  gap: var(--space-lg);
}

.tuner-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: var(--content-width);
}

.demo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: calc(var(--control-lg) + var(--space-lg));
}

.tuner-panel {
  position: sticky;
  inset-block-start: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.tuner-presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.tuner-field,
.tuner-output {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.tuner-label {
  display: flex;
  justify-content: space-between;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.tuner-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.tuner-output-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media (width < 760px) {
  .tuner {
    grid-template-columns: minmax(0, 1fr);
  }

  .tuner-panel {
    position: static;
    order: -1;
  }
}

.tuner-code {
  margin: 0;
  padding: var(--space-sm);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
