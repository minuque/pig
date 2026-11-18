<template>
  <div class="tuner">
    <!-- 亮暗两块预览并排，变量只写在各自子树上 -->
    <section class="previews">
      <div
        v-for="theme in THEMES"
        :key="theme"
        class="panel"
        :class="theme"
        :style="{ ...previewVars(colors[theme]), ...RT_VARS }"
      >
        <aside class="panel-side">
          <div
            v-for="(row, index) in ROWS"
            :key="row"
            class="side-row"
            :data-on="index === 1 || undefined"
          >
            <span class="side-meta">pig · {{ index + 2 }}h</span>
            <span class="side-title">{{ row }}</span>
          </div>
        </aside>

        <div class="panel-main">
          <UserMessage :item="USER_SHORT" />
          <p class="text-fg">正文：把卡片外环和行间分隔收进一组变量，组件只读语义层。</p>
          <p class="text-secondary">次要：运行 2 条命令，编辑 4 个文件，用时 18 秒。</p>
          <p class="text-faint">弱：2 小时前 · DeepSeek V4.1 Flash</p>

          <div class="panel-card">
            卡片底色
            <code>--bg-surface</code>

            <div class="panel-pop">
              浮层
              <code>--bg-raised</code>
            </div>
          </div>
        </div>

        <table class="ratios">
          <thead>
            <tr>
              <th />
              <th v-for="ground in GROUNDS" :key="ground">{{ ground }}</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="row in ratios(colors[theme])" :key="row.key">
              <th>{{ LABELS[row.key] }}</th>

              <td
                v-for="(value, index) in row.values"
                :key="index"
                :data-low="value < MIN[row.key] || undefined"
              >
                {{ value.toFixed(1) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="tuner-panel">
      <div class="tuner-head">
        <TabsRoot
          :model-value="editing"
          @update:model-value="(v) => (editing = v === 'dark' ? 'dark' : 'light')"
        >
          <TabsList variant="segmented" size="s">
            <TabsTrigger value="light">浅色</TabsTrigger>
            <TabsTrigger value="dark">深色</TabsTrigger>
          </TabsList>
        </TabsRoot>

        <Button size="s" variant="ghost" color="gray" @click="reset">恢复当前值</Button>
      </div>

      <label v-for="field in SHARED" :key="field.key" class="tuner-field">
        <span class="tuner-label">
          {{ field.label }}
          <span class="tuner-value">{{ params[field.key].toFixed(field.digits) }}</span>
        </span>

        <Slider
          :model-value="[params[field.key]]"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          size="s"
          @update:model-value="(next) => (params[field.key] = next?.[0] ?? params[field.key])"
        />
      </label>

      <label v-for="field in LEVELS" :key="field.key" class="tuner-field">
        <span class="tuner-label">
          {{ field.label }}
          <span class="tuner-value">
            {{ params[editing][field.key].toFixed(3) }} · {{ swatch(field.key) }}
          </span>
        </span>

        <Slider
          :model-value="[params[editing][field.key]]"
          :min="field.range[editing][0]"
          :max="field.range[editing][1]"
          :step="0.001"
          size="s"
          @update:model-value="
            (next) => (params[editing][field.key] = next?.[0] ?? params[editing][field.key])
          "
        />
      </label>

      <div class="tuner-output">
        <div class="tuner-output-head">
          <span class="tuner-label">粘回 style/tokens.css</span>

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
import { TabsList, TabsRoot, TabsTrigger } from "@components/ui/tabs/index.js"
import { Slider } from "@components/ui/slider/index.js"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import { USER_SHORT } from "@features/design-lab/lib/fixtures.js"
import {
  DEFAULTS,
  cssBlock,
  previewVars,
  ratios,
  scheme,
  type Levels,
  type Params,
} from "@features/design-lab/lib/color-tuner.js"

type Theme = "light" | "dark"

const THEMES: Theme[] = ["light", "dark"]
const ROWS = ["把折叠阈值调到 12 行", "token 收成三层", "发布 GitHub Release"]
const GROUNDS = ["主区", "侧栏", "卡片"]
const LABELS = { fg: "正文", secondary: "次要", faint: "弱" }
// 低于 AA 4.5 标红：弱级也承载会话标题、空状态等必要文字
const MIN = { fg: 4.5, secondary: 4.5, faint: 4.5 }
// rt 的灰阶 alpha 在 .radix-themes 上就算好了，预览块换了明暗要在自己身上重算一次
const RT_VARS = {
  "--border": "var(--gray-a4)",
  "--border-subtle": "var(--gray-a3)",
  "--bg-selected": "var(--accent-a4)",
  "--bg-hover": "var(--accent-a3)",
}
const SHARED: {
  key: "hue" | "chroma"
  label: string
  min: number
  max: number
  step: number
  digits: number
}[] = [
  { key: "hue", label: "色相（OKLCH h）", min: 0, max: 360, step: 1, digits: 0 },
  { key: "chroma", label: "色度（表面，文字取两倍）", min: 0, max: 0.03, step: 0.001, digits: 3 },
]
const LEVELS: { key: keyof Levels; label: string; range: Record<Theme, [number, number]> }[] = [
  { key: "bg", label: "主区亮度", range: { light: [0.9, 1], dark: [0.1, 0.3] } },
  { key: "step", label: "层差（侧栏低、卡片高）", range: { light: [0, 0.04], dark: [0, 0.04] } },
  { key: "raised", label: "浮层亮度", range: { light: [0.9, 1], dark: [0.15, 0.35] } },
  { key: "fg", label: "正文亮度", range: { light: [0.15, 0.5], dark: [0.65, 0.98] } },
  { key: "secondary", label: "次要亮度", range: { light: [0.3, 0.65], dark: [0.5, 0.85] } },
  { key: "faint", label: "弱级亮度", range: { light: [0.4, 0.75], dark: [0.4, 0.8] } },
]
const params = reactive<Params>(structuredClone(DEFAULTS))
const editing = ref<Theme>("light")
const colors = computed(() => ({
  light: scheme(params, params.light),
  dark: scheme(params, params.dark),
}))
const output = computed(() =>
  [
    `/* oklch h ${params.hue}，c ${params.chroma}（文字 ${+(params.chroma * 2).toFixed(3)}） */`,
    cssBlock(":root", colors.value.light),
    "",
    cssBlock(".dark", colors.value.dark),
  ].join("\n"),
)
const copied = ref(false)
const { copy: write } = useClipboard({ legacy: true })

function swatch(key: keyof Levels): string {
  const map = {
    bg: "bg",
    step: "sunken",
    raised: "raised",
    fg: "fg",
    secondary: "secondary",
    faint: "faint",
  } as const
  return colors.value[editing.value][map[key]]
}

function reset() {
  Object.assign(params, structuredClone(DEFAULTS))
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
  grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
  align-items: start;
  gap: var(--space-lg);
}

.previews {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.panel {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--bg);
  box-shadow: 0 0 0 var(--border-width) var(--border);
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.panel-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding: var(--space-sm) var(--space-xs);
  background: var(--bg-sunken);
  box-shadow: inset calc(var(--border-width) * -1) 0 0 var(--border-subtle);
}

.side-row {
  display: flex;
  flex-direction: column;
  padding: var(--space-xs);
  border-radius: var(--radius-control);
}

.side-row[data-on] {
  background: var(--bg-selected);
}

.side-meta {
  color: var(--fg-faint);
  font-size: var(--text-meta);
}

.side-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
}

.panel-main p {
  margin: 0;
}

.text-secondary {
  color: var(--fg-secondary);
}

.text-faint {
  color: var(--fg-faint);
  font-size: var(--text-meta);
}

.panel-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  box-shadow: 0 0 0 var(--border-width) var(--border);
}

.panel-pop {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-card);
  background: var(--bg-raised);
  box-shadow: var(--shadow-popover);
}

.panel code {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
}

.ratios {
  grid-column: 1 / -1;
  justify-self: start;
  margin: var(--space-xs) var(--space-sm);
  border-spacing: var(--space-md) var(--space-2xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.ratios th {
  font-weight: var(--font-weight-medium);
  text-align: start;
}

.ratios td[data-low] {
  color: var(--danger-text);
}

.tuner-panel {
  position: sticky;
  inset-block-start: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.tuner-head,
.tuner-output-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  color: var(--fg-faint);
  font-size: var(--text-meta);
}

.tuner-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.tuner-code {
  margin: 0;
  padding: var(--space-sm);
  overflow-x: auto;
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  box-shadow: 0 0 0 var(--border-width) var(--border);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

@media (width < 900px) {
  .tuner {
    grid-template-columns: minmax(0, 1fr);
  }

  .tuner-panel {
    position: static;
    order: -1;
  }
}
</style>
