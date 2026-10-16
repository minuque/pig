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
      class="composer-card surface-float"
      :class="expanded ? 'is-expanded' : 'is-compact'"
    >
      <div v-if="$slots.attachments" class="attachments">
        <slot name="attachments" />
      </div>

      <div class="main">
        <div ref="editorWrap" class="editor-wrap">
          <div
            ref="editor"
            class="field"
            contenteditable="plaintext-only"
            role="textbox"
            aria-multiline="true"
            aria-label="Prompt"
            :aria-controls="commandMenu.open.value ? 'composer-command-menu' : undefined"
            :aria-activedescendant="commandMenuActiveId"
            aria-autocomplete="list"
            :data-placeholder="placeholder"
            @keydown="onEditorKeydown"
            @paste="onEditorPaste"
            @input="onEditorInput"
            @click="syncCaret"
            @keyup="syncCaret"
            @select="syncCaret"
            @blur="onEditorBlur"
          ></div>
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
import { useCommandMenu, type ChipInsert } from "@features/composer/hooks/use-command-menu.js"
import CommandMenu from "@features/composer/components/CommandMenu.vue"
import {
  clusterOffsets,
  composerFlip,
  flipMotion,
  glideClusters,
  RESIZE_SETTLE_MS,
  type FlipMotion,
} from "@features/composer/lib/composer-flip.js"
import { promptPlaceholder } from "@features/composer/index.js"

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
    placeholder: promptPlaceholder(),
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
const editor = ref<HTMLElement | null>(null)
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
const commandMenu = useCommandMenu(prompt, caret, () => props.cwd, insertChip)

/** chip 行选中：删掉触发 token、插入 chip 节点与尾随空格，重串行化 prompt。 */
function insertChip(chip: ChipInsert) {
  const el = editor.value

  if (!el) return
  // 触发 token 起点落在文本节点里：把其前后切开，chip 夹在中间
  const at = domPositionAt(el, chip.start)

  if (!at) return
  const range = document.createRange()
  range.setStart(at.node, at.offset)
  // 触发 token 的末尾
  const end = domPositionAt(el, chip.start + chip.triggerLength)

  if (end) range.setEnd(end.node, end.offset)
  range.deleteContents()
  const node = buildChip(chip)
  range.insertNode(node)
  const space = document.createTextNode(" ")
  node.after(space)
  // 光标落在空格后
  const sel = window.getSelection()
  const next = document.createRange()
  next.setStartAfter(space)
  next.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(next)
  prompt.value = serialize()
}

/** chip 节点：icon + label，contenteditable=false 让删除/光标把它当整体。 */
function buildChip(chip: ChipInsert): HTMLElement {
  const el = document.createElement("span")
  el.className = "chip"
  el.dataset.chipKind = chip.kind
  el.dataset.chipToken = chip.token.trimEnd()
  el.contentEditable = "false"
  el.innerHTML = `${chipIconSvg(chip.kind)}<span class="chip-label"></span>`
  el.querySelector(".chip-label")!.textContent = chip.label
  return el
}

const CHIP_ICONS: Record<ChipInsert["kind"], string> = {
  // 立方体（技能）、文档（模板/文件）、命令行（内置）
  skill:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
  builtin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
}

function chipIconSvg(kind: ChipInsert["kind"]): string {
  return `<span class="chip-icon" aria-hidden="true">${CHIP_ICONS[kind]}</span>`
}

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
    2 * (token("--spacing-xs") + token("--border-width")) +
    4 * token("--spacing-xs") +
    token("--size-composer-control")
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

/** 外部赋 prompt 时把纯文本渲回 DOM；含 chip 的文本只在没有 chip 节点时直接写。 */
function renderPrompt(text: string) {
  const el = editor.value

  if (!el) return
  el.textContent = text
}

watch(
  prompt,
  (next) => {
    // 外部赋值（队列回填、清空）时重建 DOM；编辑器内输入已同步过，跳过
    if (editor.value && serialize() !== next) renderPrompt(next)

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
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
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

/** contenteditable 输入后把 DOM 串行化回 prompt；chip 节点展开成原始 token。 */
function onEditorInput() {
  syncCaret()
  prompt.value = serialize()
}

/** 光标在纯文本偏移上的位置：遍历 DOM 树把文本节点长度、chip 的 token 长度累加。 */
function domCaretOffset(): number {
  const el = editor.value

  if (!el) return caret.value
  const sel = window.getSelection()

  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return caret.value
  let offset = 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  const anchor = sel.anchorNode!
  const anchorOffset = sel.anchorOffset
  let node: Node | null = walker.currentNode

  // TreeWalker 从根开始；先定位到 anchor 之前的节点
  while (node && node !== anchor) {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0
    } else if (node instanceof HTMLElement && node.dataset.chipToken) {
      offset += node.dataset.chipToken.length
    }

    node = walker.nextNode()
  }

  if (anchor.nodeType === Node.TEXT_NODE) return offset + anchorOffset
  // anchor 是元素：取子节点偏移之前的文本
  return offset
}

/** 把 DOM 序列化成 prompt 文本：chip 展开成 data-token，普通文本原样。 */
function serialize(): string {
  const el = editor.value

  if (!el) return ""
  let text = ""

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
    } else if (node instanceof HTMLElement) {
      if (node.dataset.chipToken) text += node.dataset.chipToken
      else if (node.tagName === "BR") text += "\n"
      else if (node.tagName === "DIV") text += `\n${node.textContent ?? ""}`
      else text += node.textContent
    }
  }

  // contenteditable 的首行是直接文本节点；首行是 DIV 时不补开头的 \n
  return text.replace(/^\n/, "")
}

/** 光标位置同步给触发器检测；选区取起点即可。 */
function syncCaret() {
  caret.value = domCaretOffset()
}

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

/** 把纯文本偏移映射到 DOM 节点与内偏移；chip 占整段 token 长度，落在其内部时锚到边界。 */
function domPositionAt(root: HTMLElement, offset: number): { node: Node; offset: number } | null {
  let remaining = offset
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.nextNode()
  let lastText: Node | null = null

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      lastText = node

      if (remaining <= len) return { node, offset: remaining }
      remaining -= len
    } else if (node instanceof HTMLElement && node.dataset.chipToken) {
      const len = node.dataset.chipToken.length
      const index = Array.prototype.indexOf.call(node.parentNode?.childNodes ?? [], node)

      if (remaining <= len) {
        // 命中 chip：偏移前锚到 chip 前，否则锚到后
        return { node: node.parentNode!, offset: index + (remaining > len / 2 ? 1 : 0) }
      }

      remaining -= len
    }

    node = walker.nextNode()
  }

  if (lastText) return { node: lastText, offset: lastText.textContent?.length ?? 0 }
  return { node: root, offset: 0 }
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
  border: var(--border-width) solid var(--composer-border);
  border-radius: inherit;
  corner-shape: var(--corner-shape-composer);
  box-shadow: inset 0 1px 0 var(--composer-highlight);
  transition: height var(--duration-composer-flip) var(--ease-fold);
}

.composer-card > * {
  position: relative;
  z-index: 2;
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
  /* 控件 32 + 上下各 8 */
  height: calc(var(--size-composer-control) + 2 * var(--spacing-xs));
  gap: var(--spacing-xs);
  padding-inline: var(--spacing-xs);
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
  /* 文本左缘对齐附件 icon 右缘：紧凑态主行 gap 已被左侧 cluster 占掉 */
  margin-inline-start: calc(-1 * var(--spacing-xs));
}

.is-expanded .editor-wrap {
  padding: 14px var(--spacing-md) var(--spacing-xs);
}

/* 展开态：回形针与模型靠左，上下文与发送靠右；紧凑态上下文跟模型并排 */
.action-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xxs) var(--spacing-xs) var(--spacing-xs);
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
  background: transparent;
  color: var(--contrast-foreground);
  font: inherit;
  font-size: var(--text-body-md);
  line-height: 1.5;
  overscroll-behavior: contain;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
}

.is-compact .field {
  overflow: hidden;
  white-space: nowrap;
}

.is-expanded .field {
  min-height: 36px;
  max-height: 25dvh;
}

/* contenteditable 的 placeholder：空内容时显示 data-placeholder */
.field:empty::before {
  content: attr(data-placeholder);
  color: var(--placeholder);
  pointer-events: none;
}

/* 内嵌 chip：accent 色 icon+label，不可编辑、随文本流动 */
.field :deep(.chip) {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  max-width: 100%;
  margin-inline: 1px;
  padding: 1px var(--spacing-xxs);
  border-radius: var(--radius-xs);
  background: var(--info-bg);
  color: var(--info);
  font-weight: var(--font-weight-medium);
  font-size: inherit;
  line-height: inherit;
  vertical-align: baseline;
  user-select: none;
  cursor: default;
}

.field :deep(.chip-icon) {
  display: inline-flex;
  align-self: center;
  flex: none;
}

.field :deep(.chip-icon svg) {
  width: 0.95em;
  height: 0.95em;
}

.field :deep(.chip-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field ::selection,
.field::selection {
  background: Highlight;
  color: HighlightText;
}
</style>
