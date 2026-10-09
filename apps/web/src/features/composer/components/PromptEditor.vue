<template>
  <div ref="container" class="composer" @mousedown="onComposerMousedown">
    <Transition name="menu-reveal">
      <CommandMenu
        v-if="commandMenu.open.value"
        class="command-menu-float"
        :groups="commandMenu.groups.value"
        :active-id="commandMenu.activeId.value"
        :loading="commandMenu.loading.value"
        :empty-text="commandMenu.emptyText.value"
        :aria-label="commandMenuAriaLabel"
        @select="commandMenu.select"
        @highlight="(id) => (commandMenu.activeId.value = id)"
      />
    </Transition>

    <div
      ref="card"
      class="composer-card surface-float squircle"
      :class="expanded ? 'is-expanded' : 'is-compact'"
    >
      <div v-if="$slots.attachments" class="attachments">
        <slot name="attachments" />
      </div>

      <div class="main">
        <div ref="editorWrap" class="editor-wrap">
          <textarea
            ref="editor"
            v-model="prompt"
            class="field"
            :placeholder="placeholder"
            aria-label="Prompt"
            :aria-controls="commandMenu.open.value ? 'composer-command-menu' : undefined"
            :aria-activedescendant="commandMenuActiveId"
            rows="1"
            aria-autocomplete="list"
            @keydown="onEditorKeydown"
            @paste="onEditorPaste"
            @input="syncCaret"
            @click="syncCaret"
            @keyup="syncCaret"
            @select="syncCaret"
            @blur="onEditorBlur"
          ></textarea>
        </div>

        <div class="action-row">
          <div ref="leftCluster" class="cluster left">
            <slot name="left" />
          </div>

          <div ref="usageCluster" class="cluster context">
            <slot name="usage" />
          </div>

          <div ref="toolsCluster" class="cluster tools">
            <slot name="tools" />
          </div>

          <div ref="rightCluster" class="cluster right">
            <slot name="right" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export function shouldSubmitOnKeydown(e: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { clipboardFiles } from "@features/composer/hooks/use-composer-attachments.js"
import { useCommandMenu } from "@features/composer/hooks/use-command-menu.js"
import CommandMenu from "@features/composer/components/CommandMenu.vue"
import {
  clusterOffsets,
  composerFlip,
  flipMotion,
  glideClusters,
  RESIZE_SETTLE_MS,
  type FlipMotion,
} from "@features/composer/lib/composer-flip.js"
import { PROMPT_PLACEHOLDER } from "@features/composer/index.js"

const props = withDefaults(
  defineProps<{
    placeholder?: string
    /** 外层宽度手柄拖拽中：此期间不折叠。 */
    resizing?: boolean
    /** 新会话首屏：输入卡恒展开。 */
    hero?: boolean
    /** @ 文件与 / 命令搜索的根目录；未给时触发菜单不出现。 */
    cwd?: string | undefined
  }>(),
  {
    placeholder: PROMPT_PLACEHOLDER,
    resizing: false,
    hero: false,
    cwd: undefined,
  },
)
const prompt = defineModel<string>("prompt", { required: true })
const emit = defineEmits<{
  submit: []
  "paste-files": [files: File[]]
}>()
const editor = ref<HTMLTextAreaElement | null>(null)
const editorWrap = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const leftCluster = ref<HTMLElement | null>(null)
const usageCluster = ref<HTMLElement | null>(null)
const toolsCluster = ref<HTMLElement | null>(null)
const rightCluster = ref<HTMLElement | null>(null)
const expanded = ref(true)
const hasText = computed(() => prompt.value.length > 0)
const caret = ref(0)
const commandMenu = useCommandMenu(prompt, caret, () => props.cwd)
const commandMenuAriaLabel = computed(() => "输入卡命令")
const commandMenuActiveId = computed(() => {
  const id = commandMenu.activeId.value
  return id ? `composer-command-menu-row-${encodeURIComponent(id)}` : undefined
})
let widthObserver: ResizeObserver | undefined
let lastWidth = 0
/** 紧凑态实测容量与当时容器宽度；展开态用宽度差平移，绝不用展开态测量值回灌。 */
let lastCompactCapacity = 0
let lastCompactContainerWidth = 0
let firstFlip = true
let measureCtx: CanvasRenderingContext2D | undefined
const internalResizing = ref(false)
let resizeTimer: ReturnType<typeof setTimeout> | undefined
const resizing = computed(() => props.resizing || internalResizing.value)

function fitEditor() {
  const el = editor.value

  if (!el) return
  el.style.height = "auto"
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 240)}px`
}

function measureText(text: string) {
  const el = editor.value

  if (!el) return 0

  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d") ?? undefined

  if (!measureCtx) return text.length * 8
  const style = getComputedStyle(el)

  measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return measureCtx.measureText(text).width
}

/** 紧凑态被内边距、动作行与间距占掉的水平空间：只在首次实测前用来估容量。 */
function compactInset(el: HTMLElement) {
  const style = getComputedStyle(el)
  const token = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0
  // 两侧内边距 + 输入区左右内边距 + 主行两个间隙 + 回形针按钮
  return (
    2 * (token("--spacing-sm") + token("--border-width")) +
    4 * token("--spacing-xs") +
    token("--size-icon-button")
  )
}

function currentCapacity() {
  const wrap = editorWrap.value
  const containerEl = container.value

  if (!wrap || !containerEl) return 0
  const width = containerEl.clientWidth

  if (!expanded.value) {
    lastCompactCapacity = wrap.clientWidth
    lastCompactContainerWidth = width
  }

  // 还没量过紧凑态：先按 token 估算，实测后只用容器宽度差平移
  if (!lastCompactContainerWidth) return Math.max(0, width - compactInset(containerEl))
  return Math.max(0, lastCompactCapacity + (width - lastCompactContainerWidth))
}

function evaluate(motion?: FlipMotion) {
  const text = prompt.value
  const hasNewline = text.includes("\n")
  const textWidth = hasNewline ? 0 : measureText(text)
  const next = composerFlip({
    hero: props.hero,
    hasNewline,
    textWidth,
    capacity: currentCapacity(),
    expanded: expanded.value,
    resizing: resizing.value,
  })

  flipMode(next, motion)
}

function clusters() {
  return [leftCluster.value, usageCluster.value, toolsCluster.value, rightCluster.value].filter(
    (el): el is HTMLElement => el !== null,
  )
}

/** 底锚形变：胶囊底边不动，高度从旧值过渡到新值，动作组同钟换槽。 */
function flipMode(next: boolean, motion?: FlipMotion) {
  if (next === expanded.value) return
  const cardEl = card.value
  const from = cardEl?.offsetHeight ?? 0
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  if (firstFlip || !cardEl || reduce) {
    firstFlip = false
    expanded.value = next

    if (!next) clearFieldHeight()
    else void nextTick().then(fitEditor)
    return
  }

  const timing = motion ?? flipMotion(cardEl)
  const els = clusters()
  const starts = clusterOffsets(cardEl, els)

  expanded.value = next

  if (!next) clearFieldHeight()

  void nextTick().then(() => {
    if (next) fitEditor()
    requestAnimationFrame(() => {
      glideClusters(cardEl, els, starts, timing, toolsCluster.value)
      const to = cardEl.offsetHeight

      if (to <= 0 || Math.abs(from - to) < 1) return
      cardEl.style.transitionDuration = `${timing.duration}ms`
      cardEl.style.transitionTimingFunction = timing.easing
      cardEl.style.height = `${from}px`
      void cardEl.offsetHeight
      cardEl.style.height = `${to}px`

      const done = (event?: TransitionEvent) => {
        if (event && event.propertyName !== "height") return
        cardEl.removeEventListener("transitionend", done)
        cardEl.style.height = ""
        cardEl.style.transitionDuration = ""
        cardEl.style.transitionTimingFunction = ""
      }

      cardEl.addEventListener("transitionend", done)
      setTimeout(done, timing.duration + 40)
    })
  })
}

function clearFieldHeight() {
  const el = editor.value

  if (el) el.style.height = ""
}

watch(
  prompt,
  () => {
    if (expanded.value) fitEditor()
    evaluate()
  },
  { flush: "post" },
)

watch(
  container,
  (el) => {
    widthObserver?.disconnect()
    widthObserver = undefined
    lastWidth = 0

    if (!el) return
    widthObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0

      if (width === lastWidth) return
      lastWidth = width
      internalResizing.value = true

      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        internalResizing.value = false
        evaluate()
      }, RESIZE_SETTLE_MS)

      if (expanded.value) fitEditor()
      evaluate()
    })
    widthObserver.observe(el)
    evaluate()
  },
  { flush: "post" },
)

watch(resizing, () => evaluate())

// 首屏↔会话的展开形变跟输入卡停靠同一条时间线
watch(
  () => props.hero,
  (hero) => evaluate(card.value ? flipMotion(card.value, hero ? "out" : "in") : undefined),
)

onBeforeUnmount(() => {
  widthObserver?.disconnect()

  if (resizeTimer) clearTimeout(resizeTimer)
})

function focus() {
  const el = editor.value

  if (!el) return
  el.focus()
  el.selectionStart = el.selectionEnd = el.value.length
}

function onEditorKeydown(e: KeyboardEvent) {
  syncCaret()

  // 菜单开时先吃导航键；Escape 让菜单先关，空输入再 blur
  if (commandMenu.onKeydown(e)) return

  if (e.key === "Escape" && !e.isComposing && !hasText.value) editor.value?.blur()

  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault()
    emit("submit")
  }
}

/** 光标位置同步给触发器检测；选区取起点即可。 */
function syncCaret() {
  const el = editor.value

  if (el) caret.value = el.selectionStart ?? el.value.length
}

/** 菜单选中插入文本后，把 ref 写回真实光标；否则浏览器落在文本末尾。 */
watch(caret, async (next) => {
  await nextTick()
  const el = editor.value

  if (el && el.selectionStart !== next) el.setSelectionRange(next, next)
})

/** 编辑器失焦关菜单；点面板自身不触发（mousedown 已 prevent）。 */
function onEditorBlur() {
  commandMenu.close()
}

/** 只在真的收到文件时拦截粘贴，纯文本粘贴仍走浏览器默认行为。 */
function onEditorPaste(e: ClipboardEvent) {
  const files = clipboardFiles(e.clipboardData)

  if (!files.length) return
  e.preventDefault()
  emit("paste-files", files)
}

function onComposerMousedown(e: MouseEvent) {
  const el = e.target

  if (!(el instanceof Element)) return

  if (el.closest("button, input, textarea, a, [role='menuitem']")) return
  e.preventDefault()
  focus()
}

defineExpose({ focus })
</script>

<style scoped>
.composer {
  position: relative;
  width: 100%;
  margin-inline: auto;
  border-radius: var(--composer-radius);
  box-shadow: var(--composer-shadow);
}

/* @// 面板浮在输入卡上方，不占布局；菜单自身圆角与描边在组件内。 */
.command-menu-float {
  margin-bottom: var(--spacing-xxs);
}

.composer-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  border-radius: inherit;
  transition: height var(--duration-composer-flip) var(--ease-composer-flip);
}

/* 内描边不占布局 */
.composer-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 var(--border-width) var(--composer-border);
  pointer-events: none;
  transition: box-shadow var(--duration-fast) var(--ease-out);
}

.composer-card:focus-within::before {
  box-shadow: inset 0 0 0 var(--border-width) var(--composer-ring);
}

@media (prefers-reduced-motion: reduce) {
  .composer-card {
    transition: none;
  }
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) calc(var(--spacing-md) + var(--border-width)) 0;
}

.main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.is-compact .main {
  height: 49px;
  gap: var(--spacing-xs);
  padding-inline: calc(var(--spacing-sm) + var(--border-width));
}

.is-expanded .main {
  flex-direction: column;
  align-items: stretch;
}

/* 紧凑态动作行拆进主行：回形针在输入框前，模型、上下文与发送在后 */
.is-compact .action-row {
  display: contents;
}

.is-compact .cluster.left {
  order: -1;
}

.editor-wrap {
  min-width: 0;
}

.is-compact .editor-wrap {
  flex: 1;
  padding-inline: var(--spacing-xs);
}

.is-expanded .editor-wrap {
  padding: var(--spacing-md) calc(var(--spacing-md) + var(--border-width)) var(--spacing-xxs);
}

/* 展开态：回形针与模型靠左，上下文与发送靠右；紧凑态上下文跟模型并排 */
.action-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  height: 42px;
  padding: 0 calc(var(--spacing-sm) + var(--border-width));
}

.cluster {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex: none;
  min-width: 0;
}

/* 展开态动作行保持紧凑态槽位 */
.cluster.context {
  margin-inline-start: auto;
}

.cluster.tools {
  flex: 0 1 auto;
}

.is-compact .cluster.right,
.is-compact .cluster.context {
  order: 0;
  margin-inline-start: 0;
}

.is-compact .cluster.tools {
  /* 模型 chip 在紧凑态最多占胶囊宽 45% */
  max-width: 45%;
}

.field {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--text-body-md);
  line-height: 1.625;
  overscroll-behavior: contain;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.is-compact .field {
  overflow: hidden;
  white-space: nowrap;
}

.is-expanded .field {
  min-height: 56px;
  max-height: 240px;
}

.field::placeholder {
  color: var(--ink-faint);
}

.field ::selection,
.field::selection {
  background: Highlight;
  color: HighlightText;
}
</style>
