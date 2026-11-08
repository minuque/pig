<template>
  <div class="tuner">
    <!-- 预览区：变量只写在这个子树上，用的是真实组件 -->
    <section class="tuner-preview" :style="previewVars">
      <Card size="s" class="demo-settings">
        <div v-for="row in SETTINGS_ROWS" :key="row" class="demo-row">
          <span>{{ row }}</span>
          <Switch :model-value="true" size="s" />
        </div>
      </Card>

      <MarkdownContent :nodes="nodes" />

      <Callout variant="surface" size="s" color="destructive">
        <template #icon><DangerCircleIcon /></template>
        <template #title>出错了</template>
        Callout 的边框不读卡片变量，放在这里作对照。
      </Callout>
    </section>

    <section class="tuner-panel">
      <div class="tuner-presets">
        <Button
          v-for="preset in PRESETS"
          :key="preset.name"
          size="s"
          :variant="isPreset(preset) ? 'soft' : 'surface'"
          color="gray"
          @click="apply(preset)"
        >
          {{ preset.name }}
        </Button>
      </div>

      <div class="tuner-field">
        <span class="tuner-label">外环颜色 --border</span>

        <SegmentedControl v-model="value.border" size="s">
          <SegmentedControlItem v-for="step in STEPS" :key="step" :value="step">
            {{ step }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div class="tuner-field">
        <span class="tuner-label">行间分隔 --border-soft</span>

        <SegmentedControl v-model="value.divider" size="s">
          <SegmentedControlItem v-for="step in STEPS" :key="step" :value="step">
            {{ step }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div class="tuner-field">
        <span class="tuner-label">
          圆角 --radius-card
          <span class="tuner-value">{{ value.radius }}px</span>
        </span>

        <Slider v-model="radius" :min="4" :max="16" :step="0.4" size="s" />
      </div>

      <div class="tuner-field">
        <span class="tuner-label">底色 --card-surface</span>

        <SegmentedControl v-model="value.surface" size="s">
          <SegmentedControlItem v-for="(_, key) in SURFACES" :key="key" :value="key">
            {{ key }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div class="tuner-output">
        <div class="tuner-output-head">
          <span class="tuner-label">粘回 style/rt.css 与 tokens.css</span>

          <Button size="s" variant="ghost" color="gray" @click="copy">
            {{ copied ? "已复制" : "复制" }}
          </Button>
        </div>

        <pre class="tuner-code">{{ output }}</pre>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { useClipboard } from "@vueuse/core"
import { Button } from "@components/ui/button/index.js"
import { Callout } from "@components/ui/callout/index.js"
import { Card } from "@components/ui/card/index.js"
import { SegmentedControl, SegmentedControlItem } from "@components/ui/segmented-control/index.js"
import { Slider } from "@components/ui/slider/index.js"
import { Switch } from "@components/ui/switch/index.js"
import { DangerCircleIcon } from "@components/icons/index.js"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"

type Values = { border: string; divider: string; radius: number; surface: string }

const STEPS = ["a3", "a4", "a5", "a6", "a7", "a8"]
const SURFACES: Record<string, string> = {
  none: "transparent",
  a2: "var(--gray-a2)",
  card: "var(--card)",
  code: "var(--code-surface)",
}
const PRESETS: (Values & { name: string })[] = [
  { name: "当前", border: "a6", divider: "a5", radius: 10.4, surface: "none" },
  { name: "更淡", border: "a5", divider: "a4", radius: 12, surface: "none" },
  { name: "更清晰", border: "a7", divider: "a6", radius: 8, surface: "none" },
  { name: "浅底", border: "a5", divider: "a4", radius: 10.4, surface: "a2" },
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
  "| `--border-soft` | 行间分隔 |",
].join("\n")
const nodes = useMarkdownNodes({
  text: () => SAMPLE,
  streaming: () => false,
  cacheKey: () => "design-tuner",
})
const value = reactive<Values>({ ...PRESETS[0]! })
const radius = computed({
  get: () => [value.radius],
  set: ([next]) => (value.radius = next ?? value.radius),
})
const rem = computed(() => `${+(value.radius / 16).toFixed(3)}rem`)
const previewVars = computed(() => ({
  "--border": `var(--gray-${value.border})`,
  "--border-soft": `var(--gray-${value.divider})`,
  "--divider-top": `inset 0 var(--border-width) 0 var(--gray-${value.divider})`,
  "--radius-card": rem.value,
  "--card-surface": SURFACES[value.surface],
}))
const output = computed(() =>
  [
    "/* style/rt.css → .radix-themes */",
    `--border: var(--gray-${value.border});`,
    `--border-soft: var(--gray-${value.divider});`,
    `--card-surface: ${SURFACES[value.surface]};`,
    "",
    "/* style/tokens.css → :root */",
    `--radius-card: ${rem.value};`,
  ].join("\n"),
)
const copied = ref(false)
const { copy: write } = useClipboard({ legacy: true })

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
  max-width: var(--size-content);
}

.demo-settings {
  --card-padding: 0;

  padding-inline: var(--space-md);
}

.demo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: calc(var(--size-control) + var(--space-lg));
}

.demo-row + .demo-row {
  box-shadow: var(--divider-top);
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
  color: var(--contrast-foreground-faint);
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

/* 窄窗口上下排：调节区在上，预览在下 */
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
  border-radius: var(--radius-sm);
  background: var(--code-surface);
  font-family: var(--font-mono);
  font-size: var(--text-code-sm);
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
