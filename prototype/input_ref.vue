<script setup lang="ts">
import { computed, onBeforeUnmount, nextTick, ref, watch } from "vue";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  X,
} from "lucide-vue-next";

const ENHANCED =
  "This is an example prompt — rewritten to be clear and specific: state the goal, add the relevant context and constraints, define the expected output format and tone, and note any assumptions. Ask a clarifying question first if key details are missing.";

/**
 * Integration seam: replace the mock body with a real request to your
 * model/API. It only needs to resolve to the enhanced prompt string.
 */
async function mockEnhance(prompt: string, signal?: AbortSignal): Promise<string> {
  await new Promise((r) => setTimeout(r, 2500));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return ENHANCED;
  // const res = await fetch("/api/enhance", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ prompt }),
  //   signal,
  // });
  // if (!res.ok) throw new Error("Enhance request failed");
  // return (await res.json()).prompt as string;
}

const props = withDefaults(
  defineProps<{ onEnhance?: (prompt: string, signal?: AbortSignal) => Promise<string> }>(),
  { onEnhance: mockEnhance },
);

const MODELS = [
  {
    id: "claude-opus-4.8",
    name: "Claude Opus 4.8",
    desc: "Anthropic's most capable model — best for complex, multi-step reasoning.",
    context: "200k context window",
  },
  {
    id: "gpt-5.6",
    name: "GPT-5.6",
    desc: "OpenAI's flagship — strong all-round performance and tool use.",
    context: "400k context window",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    desc: "Google's long-context model — great for large documents and codebases.",
    context: "1M context window",
  },
];

const SKILLS = [
  { id: "deep-research", name: "Deep Research" },
  { id: "code-review", name: "Code Review" },
  { id: "web-search", name: "Web Search" },
  { id: "summarize", name: "Summarize" },
];

const skillName = (id: string) => SKILLS.find((sk) => sk.id === id)?.name ?? id;
const escapeHtml = (str: string) =>
  str.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

type Phase = "idle" | "enhancing" | "enhanced";
type Attachment = { id: number; name: string; kind: "image" | "file" };

const value = ref("");
const phase = ref<Phase>("idle");
const menuOpen = ref(false);
const skillsOpen = ref(false);
const hoveredModel = ref<string | null>(null);
const model = ref(MODELS[0].id);
const attachments = ref<Attachment[]>([]);
// ids of chips currently playing their exit animation before removal
const exitingAtt = ref<number[]>([]);

// Keep the enhance pill mounted through a short exit so it leaves the same
// soft way it arrives (mirrors pi-pill-in / pi-pill-out).
const pillMounted = ref(false);
const pillExiting = ref(false);
let pillTimer: ReturnType<typeof setTimeout> | null = null;

const slashOpen = ref(false);
const slashQuery = ref("");
const slashIndex = ref(0);
const slashKeyboard = ref(false);
let lastSlashQuery = "";
let ignoreHover = false;

const editor = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const plusWrap = ref<HTMLElement | null>(null);
const fileRef = ref<HTMLInputElement | null>(null);
let preEnhanceHTML = "";
let pendingHTML: string | null = null;
// height of the frame captured right before an enhance/revert swap, so the
// new height can be animated from it (FLIP) instead of jumping.
let flipFrom: number | null = null;
let savedRange: Range | null = null;
let abort: AbortController | null = null;
let nextId = 1;

const hasText = computed(() => value.value.trim().length > 0);
const enhancing = computed(() => phase.value === "enhancing");
const sendActive = computed(() => hasText.value && !enhancing.value);
const showPill = computed(() => hasText.value && !enhancing.value);
const slashResults = computed(() =>
  SKILLS.filter((sk) => sk.name.toLowerCase().includes(slashQuery.value.toLowerCase())),
);

// Drive the enhance pill's mount/exit — enter with text, play the exit first
// when leaving, but swap instantly when handing over to the spinner.
watch(
  showPill,
  (show) => {
    if (show) {
      pillMounted.value = true;
      pillExiting.value = false;
      if (pillTimer) {
        clearTimeout(pillTimer);
        pillTimer = null;
      }
      return;
    }
    if (!pillMounted.value) return;
    if (enhancing.value) {
      pillMounted.value = false;
      pillExiting.value = false;
      return;
    }
    pillExiting.value = true;
    if (pillTimer) clearTimeout(pillTimer);
    pillTimer = setTimeout(() => {
      pillMounted.value = false;
      pillExiting.value = false;
      pillTimer = null;
    }, 200);
  },
  { immediate: true },
);

// Focus the editor and drop the caret at the very end of its content.
function focusEnd() {
  const el = editor.value;
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  savedRange = range.cloneRange();
}
function syncFromEditor() {
  const el = editor.value;
  if (!el) return;
  value.value = el.textContent ?? "";
  // Mark pills at the very start (nothing but whitespace before them) so CSS can
  // drop their left margin — :first-child can't see leading text nodes.
  el.querySelectorAll<HTMLElement>(".skill-pill").forEach((pill) => {
    let atStart = true;
    for (let n = pill.previousSibling; n; n = n.previousSibling) {
      if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() === "") continue;
      atStart = false;
      break;
    }
    pill.toggleAttribute("data-start", atStart);
  });
}
function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount && editor.value && editor.value.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
}
function closeSlash() {
  slashOpen.value = false;
  slashQuery.value = "";
  slashIndex.value = 0;
  slashKeyboard.value = false;
  lastSlashQuery = "";
  ignoreHover = false;
}
function buildPill(id: string) {
  const name = skillName(id);
  const el = document.createElement("span");
  el.className = "skill-pill";
  el.setAttribute("contenteditable", "false");
  el.dataset.skill = id;
  el.innerHTML =
    '<span class="skill-pill-label">/' +
    escapeHtml(name) +
    "</span>" +
    '<button type="button" class="skill-pill-x" data-remove="1" aria-label="Remove ' +
    escapeHtml(name) +
    '"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
  return el;
}
function insertPillOverRange(range: Range, id: string) {
  if (!editor.value) return;
  range.deleteContents();
  const pill = buildPill(id);
  range.insertNode(pill);
  const space = document.createTextNode("\u00A0");
  pill.after(space);
  const after = document.createRange();
  after.setStartAfter(space);
  after.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(after);
  editor.value.focus();
  savedRange = after.cloneRange();
  syncFromEditor();
}
function addSkillFromMenu(id: string) {
  const el = editor.value;
  if (!el) return;
  const sel = window.getSelection();
  let range: Range | null = null;
  if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0).cloneRange();
  } else if (savedRange && el.contains(savedRange.startContainer)) {
    range = savedRange.cloneRange();
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  insertPillOverRange(range, id);
  menuOpen.value = false;
}
function applySlash(id: string) {
  const el = editor.value;
  const sel = window.getSelection();
  if (!el || !sel || !sel.rangeCount) return closeSlash();
  const caret = sel.getRangeAt(0);
  let range = caret.cloneRange();
  const node = caret.startContainer;
  if (node.nodeType === Node.TEXT_NODE && el.contains(node)) {
    const before = (node.textContent ?? "").slice(0, caret.startOffset);
    const m = before.match(/\/([^\s/]*)$/);
    if (m) {
      range = document.createRange();
      range.setStart(node, caret.startOffset - m[0].length);
      range.setEnd(node, caret.startOffset);
    }
  }
  insertPillOverRange(range, id);
  closeSlash();
}
function detectSlash() {
  const el = editor.value;
  const sel = window.getSelection();
  if (!el || !sel || !sel.rangeCount || !sel.isCollapsed) return closeSlash();
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return closeSlash();
  const before = (node.textContent ?? "").slice(0, range.startOffset);
  const m = before.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!m) return closeSlash();
  const q = m[1];
  if (q !== lastSlashQuery) {
    lastSlashQuery = q;
    slashIndex.value = 0;
  }
  slashQuery.value = q;
  slashOpen.value = true;
}
function onEditorInput() {
  syncFromEditor();
  if (phase.value === "enhanced") phase.value = "idle";
  detectSlash();
}
function moveSlash(delta: number) {
  const results = slashResults.value;
  if (!results.length) return;
  ignoreHover = true;
  slashKeyboard.value = true;
  slashIndex.value = (slashIndex.value + delta + results.length * 10) % results.length;
}
function onSlashMouseEnter(i: number) {
  if (ignoreHover) return;
  slashIndex.value = i;
}
function onSlashMouseMove() {
  ignoreHover = false;
  slashKeyboard.value = false;
}
function onEditorKeydown(e: KeyboardEvent) {
  const results = slashResults.value;
  if (
    slashOpen.value &&
    results.length &&
    (e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Enter" ||
      e.key === "Tab" ||
      e.key === "Escape")
  ) {
    e.preventDefault();
    return;
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}
watch(slashOpen, (open) => {
  if (!open) return;
  const onKey = (e: KeyboardEvent) => {
    const results = slashResults.value;
    if (!slashOpen.value || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      moveSlash(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      moveSlash(-1);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      applySlash((results[slashIndex.value] ?? results[0]).id);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeSlash();
    }
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
});
watch(slashResults, (results) => {
  if (slashOpen.value && results.length && slashIndex.value >= results.length) {
    slashIndex.value = 0;
  }
});
function onEditorClick(e: MouseEvent) {
  const remove = (e.target as HTMLElement).closest("[data-remove]");
  if (remove) {
    e.preventDefault();
    const pill = remove.closest<HTMLElement>("[data-skill]");
    if (pill) {
      // the separator space we inserted right after the pill — drop it too on
      // removal so leftover spaces can't accumulate and shift the next pill.
      const sep = pill.nextSibling;
      // collapse the pill's footprint (width + margins + padding) in sync with
      // the fade so following text slides in smoothly instead of snapping.
      const w = pill.getBoundingClientRect().width;
      pill.style.maxWidth = `${w}px`;
      pill.style.overflow = "hidden";
      pill.style.whiteSpace = "nowrap";
      void pill.offsetWidth;
      pill.style.transition =
        "opacity 180ms cubic-bezier(0.22,1,0.36,1), transform 180ms cubic-bezier(0.22,1,0.36,1), filter 180ms cubic-bezier(0.22,1,0.36,1), max-width 180ms cubic-bezier(0.22,1,0.36,1), margin 180ms cubic-bezier(0.22,1,0.36,1), padding 180ms cubic-bezier(0.22,1,0.36,1)";
      // leave the same soft way the enhance pill arrives, then drop the node
      pill.setAttribute("data-exit", "");
      pill.style.maxWidth = "0px";
      pill.style.marginLeft = "0px";
      pill.style.marginRight = "0px";
      pill.style.paddingLeft = "0px";
      pill.style.paddingRight = "0px";
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (sep && sep.nodeType === Node.TEXT_NODE && sep.textContent?.startsWith("\u00A0")) {
          const rest = sep.textContent.slice(1);
          if (rest) sep.textContent = rest;
          else sep.parentNode?.removeChild(sep);
        }
        pill.remove();
        syncFromEditor();
        editor.value?.focus();
      };
      pill.addEventListener("transitionend", finish, { once: true });
      setTimeout(finish, 220);
    }
    return;
  }
  saveSelection();
}

async function enhance() {
  if (!hasText.value || enhancing.value) return;
  preEnhanceHTML = editor.value?.innerHTML ?? "";
  phase.value = "enhancing";
  const ac = new AbortController();
  abort = ac;
  try {
    const result = await props.onEnhance(value.value, ac.signal);
    if (ac.signal.aborted) return;
    pendingHTML = escapeHtml(result);
    flipFrom = frame.value?.offsetHeight ?? null;
    phase.value = "enhanced";
  } catch {
    if (ac.signal.aborted) return;
    pendingHTML = preEnhanceHTML;
    phase.value = "idle";
  }
}
function revert() {
  abort?.abort();
  pendingHTML = preEnhanceHTML;
  flipFrom = frame.value?.offsetHeight ?? null;
  phase.value = "idle";
}
function send() {
  if (!sendActive.value) return;
  if (editor.value) editor.value.innerHTML = "";
  value.value = "";
  phase.value = "idle";
  attachments.value = [];
  exitingAtt.value = [];
  closeSlash();
  nextTick(() => editor.value?.focus());
}

// After an enhance/revert the editor is shown editable again — write the
// pending HTML into it (enhanced text, or the restored original w/ pills).
watch(phase, async () => {
  if (enhancing.value || pendingHTML === null) return;
  await nextTick();
  if (!editor.value) return;
  editor.value.innerHTML = pendingHTML;
  pendingHTML = null;
  syncFromEditor();
  requestAnimationFrame(focusEnd);

  // Animate the frame from its previous height to the new one so the input
  // doesn't jump when the enhanced/original text changes its size.
  const el = frame.value;
  const from = flipFrom;
  flipFrom = null;
  if (!el || from === null) return;
  const to = el.offsetHeight;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || from === to) return;
  el.style.height = from + "px";
  el.style.overflow = "hidden";
  void el.offsetHeight; // force reflow so the start height is committed
  el.style.transition = "height 200ms cubic-bezier(0.22, 1, 0.36, 1)";
  el.style.height = to + "px";
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.style.transition = "";
    el.style.height = "";
    el.style.overflow = "";
    el.removeEventListener("transitionend", finish);
  };
  el.addEventListener("transitionend", finish);
  setTimeout(finish, 260);
});

function openPicker(kind: Attachment["kind"]) {
  const input = fileRef.value;
  if (!input) return;
  input.accept = kind === "image" ? "image/*" : "";
  input.value = "";
  input.dataset.kind = kind;
  input.click();
  menuOpen.value = false;
}
function onFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) return;
  const fallback = (input.dataset.kind as Attachment["kind"]) ?? "file";
  attachments.value = [
    ...attachments.value,
    ...files.map((f) => ({
      id: nextId++,
      name: f.name,
      kind: f.type.startsWith("image/") ? ("image" as const) : fallback,
    })),
  ];
  input.value = "";
  nextTick(() => editor.value?.focus());
}
function removeAttachment(id: number) {
  // play the same soft fade/scale exit as the skill pills, then drop the chip
  if (!exitingAtt.value.includes(id)) exitingAtt.value = [...exitingAtt.value, id];
  window.setTimeout(() => {
    attachments.value = attachments.value.filter((a) => a.id !== id);
    exitingAtt.value = exitingAtt.value.filter((x) => x !== id);
  }, 200);
}
function selectModel(id: string) {
  model.value = id;
  menuOpen.value = false;
}

function onDocDown(e: PointerEvent) {
  if (menuOpen.value && plusWrap.value && !plusWrap.value.contains(e.target as Node))
    menuOpen.value = false;
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === "Escape") menuOpen.value = false;
}
watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener("pointerdown", onDocDown);
    document.addEventListener("keydown", onDocKey);
  } else {
    skillsOpen.value = false;
    hoveredModel.value = null;
    document.removeEventListener("pointerdown", onDocDown);
    document.removeEventListener("keydown", onDocKey);
  }
});
onBeforeUnmount(() => {
  abort?.abort();
  if (pillTimer) clearTimeout(pillTimer);
  document.removeEventListener("pointerdown", onDocDown);
  document.removeEventListener("keydown", onDocKey);
});
</script>

<template>
  <div class="wrap">
    <input ref="fileRef" type="file" multiple hidden @change="onFiles" />
    <div ref="frame" class="frame" :data-enhancing="enhancing || undefined">
      <div v-if="attachments.length" class="chips">
        <span
          v-for="att in attachments"
          :key="att.id"
          class="chip"
          :data-exit="exitingAtt.includes(att.id) || undefined"
        >
          <span class="chip-icon">
            <ImageIcon v-if="att.kind === 'image'" :size="13" />
            <Paperclip v-else :size="13" />
          </span>
          <span class="chip-name">{{ att.name }}</span>
          <button
            type="button"
            class="chip-remove"
            :aria-label="'Remove ' + att.name"
            @click="removeAttachment(att.id)"
          >
            <X :size="11" />
          </button>
        </span>
      </div>

      <div class="editor-wrap">
        <div v-if="enhancing" class="enhancing-text" aria-live="polite">
          {{ value }}
        </div>
        <div
          v-else
          ref="editor"
          class="field"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-label="Ask AI Agent"
          :data-empty="!hasText || undefined"
          data-placeholder="Ask AI Agent"
          @input="onEditorInput"
          @keydown="onEditorKeydown"
          @keyup="saveSelection"
          @mouseup="saveSelection"
          @blur="saveSelection"
          @click="onEditorClick"
        ></div>

        <div
          v-if="slashOpen && !enhancing"
          class="slash-menu"
          role="listbox"
          aria-label="Skills"
          :data-keyboard="slashKeyboard || undefined"
          @mousemove="onSlashMouseMove"
        >
          <div class="slash-label">Skills</div>
          <template v-if="slashResults.length">
            <button
              v-for="(sk, i) in slashResults"
              :key="sk.id"
              type="button"
              role="option"
              :aria-selected="i === slashIndex"
              class="menu-item"
              :class="{ 'menu-item-active': i === slashIndex }"
              @mousedown.prevent
              @mouseenter="onSlashMouseEnter(i)"
              @click="applySlash(sk.id)"
            >
              <span class="menu-name">{{ sk.name }}</span>
            </button>
          </template>
          <div v-else class="slash-empty">No matching skills</div>
        </div>
      </div>

      <div class="row">
        <div ref="plusWrap" class="plus-wrap">
          <button
            type="button"
            class="icon-btn plus"
            :data-open="menuOpen || undefined"
            aria-label="Add attachment or switch model"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            <span class="plus-icon"><Plus :size="14" /></span>
          </button>

          <div v-if="menuOpen" class="menu" role="menu">
            <button type="button" role="menuitem" class="menu-item" @click="openPicker('image')">
              <span class="menu-icon"><ImageIcon :size="14" /></span>
              <span class="menu-name">Add photos</span>
            </button>
            <button type="button" role="menuitem" class="menu-item" @click="openPicker('file')">
              <span class="menu-icon"><Paperclip :size="14" /></span>
              <span class="menu-name">Attach files</span>
            </button>
            <div class="menu-divider"></div>
            <div class="menu-sub" @mouseenter="skillsOpen = true" @mouseleave="skillsOpen = false">
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                aria-haspopup="menu"
                :aria-expanded="skillsOpen"
                @click="skillsOpen = true"
              >
                <span class="menu-icon"><BookOpen :size="14" /></span>
                <span class="menu-name">Skills</span>
                <span class="menu-chevron"><ChevronRight :size="14" /></span>
              </button>
              <div v-if="skillsOpen" class="menu-flyout" role="menu">
                <button
                  v-for="sk in SKILLS"
                  :key="sk.id"
                  type="button"
                  role="menuitem"
                  class="menu-item"
                  @click="addSkillFromMenu(sk.id)"
                >
                  <span class="menu-name">{{ sk.name }}</span>
                </button>
              </div>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-label">Model</div>
            <div
              v-for="m in MODELS"
              :key="m.id"
              class="menu-sub"
              @mouseenter="hoveredModel = m.id"
              @mouseleave="hoveredModel = null"
            >
              <button
                type="button"
                role="menuitemradio"
                :aria-checked="model === m.id"
                class="menu-item"
                @click="selectModel(m.id)"
              >
                <span class="menu-brand">
                  <svg
                    v-if="m.id.startsWith('gpt')"
                    width="12"
                    height="12"
                    viewBox="0 0 320 320"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z"
                    />
                  </svg>
                  <svg
                    v-else-if="m.id.startsWith('claude')"
                    width="12"
                    height="12"
                    viewBox="0 0 100 100"
                    fill="#d97757"
                    aria-hidden="true"
                  >
                    <path
                      d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"
                    />
                  </svg>
                  <svg
                    v-else
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M16 8.016A8.522 8.522 0 0 0 8.016 16h-.032A8.521 8.521 0 0 0 0 8.016v-.032A8.521 8.521 0 0 0 7.984 0h.032A8.522 8.522 0 0 0 16 7.984v.032z"
                      fill="url(#pi-gemini-grad)"
                    />
                    <defs>
                      <radialGradient
                        id="pi-gemini-grad"
                        cx="0"
                        cy="0"
                        r="1"
                        gradientUnits="userSpaceOnUse"
                        gradientTransform="matrix(16.1326 5.4553 -43.70045 129.2322 1.588 6.503)"
                      >
                        <stop offset=".067" stop-color="#9168C0" />
                        <stop offset=".343" stop-color="#5684D1" />
                        <stop offset=".672" stop-color="#1BA1E3" />
                      </radialGradient>
                    </defs>
                  </svg>
                </span>
                <span class="menu-name">{{ m.name }}</span>
                <span v-if="model === m.id" class="menu-check"><Check :size="14" /></span>
              </button>
              <div v-if="hoveredModel === m.id" class="menu-popover" role="tooltip">
                <div class="popover-title">{{ m.name }}</div>
                <p class="popover-desc">{{ m.desc }}</p>
                <div class="popover-meta">{{ m.context }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="right">
          <span v-if="enhancing" class="icon-btn spinner-btn" aria-label="Enhancing prompt">
            <Loader2 class="spinner" :size="14" />
          </span>
          <button
            v-else-if="pillMounted"
            type="button"
            class="pill"
            :class="{ 'pill-exit': pillExiting }"
            @click="phase === 'enhanced' ? revert() : enhance()"
          >
            {{ phase === "enhanced" ? "Revert" : "Enhance Prompt" }}
          </button>
          <button
            type="button"
            class="icon-btn send"
            :class="{ 'send-active': sendActive }"
            aria-label="Send"
            :disabled="!sendActive"
            @click="send"
          >
            <ArrowUp :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  max-width: 420px;
  font-family: "Inter Variable", "Inter", sans-serif;
}

.frame {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 10px 10px;
  background: #ffffff;
  /* transparent border keeps the box geometry the enhancing ::after relies on;
     the visible 0.5px hairline + drop shadow match the surrounding cards. */
  border: 0.5px solid transparent;
  border-radius: 12px;
  /* hairline ring first so it paints on top of the drops and stays even on
     every edge (otherwise the bottom is hidden by the drop shadow) */
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.08),
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 2px 4px rgba(0, 0, 0, 0.02);
}
/* with chips present, match the 10px side padding on top */
.frame:has(.chips) {
  padding-top: 10px;
}

/* enhancing: a conic-gradient ring sweeps around the border */
@property --pi-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
.frame[data-enhancing] {
  border-color: transparent;
}
.frame[data-enhancing]::after {
  content: "";
  position: absolute;
  inset: -0.5px;
  border-radius: 12.5px;
  /* border + padding-box mask keeps the ring an even 0.75px on every side —
     the older content-box/padding trick rendered the bottom edge thinner */
  border: 0.75px solid transparent;
  background: conic-gradient(from var(--pi-angle), #2b7fff, #8b5cf6, #d946ef, #22d3ee, #2b7fff)
    border-box;
  -webkit-mask:
    linear-gradient(#000 0 0) padding-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation:
    pi-border-spin 1.1s linear infinite,
    pi-border-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}
@keyframes pi-border-spin {
  to {
    --pi-angle: 360deg;
  }
}
@keyframes pi-border-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* editable field — a contentEditable div so skill pills can flow inline */
.editor-wrap {
  position: relative;
}
.field {
  position: relative;
  width: 100%;
  margin: 0;
  outline: 0;
  background: transparent;
  color: #1a1a1a;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  letter-spacing: -0.12px;
  min-height: 18px;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.field ::selection,
.field::selection {
  background: Highlight;
  color: HighlightText;
}
.field ::-moz-selection,
.field::-moz-selection {
  background: Highlight;
  color: HighlightText;
}
.field[data-empty]::before {
  content: attr(data-placeholder);
  position: absolute;
  top: 0;
  left: 0;
  color: #1a1a1a;
  opacity: 0.5;
  pointer-events: none;
}

/* inline skill pill — created via innerHTML, so styled globally (scoped
   styles wouldn't reach nodes the framework didn't render itself) */
:global(.skill-pill) {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  /* shorter than the field's 18px line-height so the pill never expands the
     line box (middle + 18px height grew the field and jumped the action gap) */
  height: 16px;
  padding: 0 0 0 5px;
  margin: 0 2px;
  border-radius: 999px;
  background: rgba(43, 127, 255, 0.12);
  color: #1f6feb;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.12px;
  white-space: nowrap;
  position: relative;
  top: -1px;
  vertical-align: baseline;
  user-select: none;
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
/* leave the same soft way the enhance pill arrives (transition-based so it
   works on the globally-styled, innerHTML-inserted node) */
:global(.skill-pill[data-exit]) {
  opacity: 0;
  transform: scale(0.96);
  filter: blur(2px);
  pointer-events: none;
}
/* at the very start of the field: drop the left margin, keep only the right
   (data-start is set in JS since :first-child ignores leading text nodes) */
:global(.skill-pill[data-start]) {
  margin-left: 0;
}
:global(.skill-pill-label) {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.skill-pill-x) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  opacity: 0.65;
  cursor: pointer;
  transition:
    opacity 150ms cubic-bezier(0.22, 1, 0.36, 1),
    background 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
:global(.skill-pill-x):hover {
  opacity: 1;
  background: rgba(43, 127, 255, 0.16);
}

/* "/" command palette — same container as the + menu, pinned above the field */
.slash-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 25;
  width: 200px;
  padding: 3px;
  background: #ffffff;
  border: 0.5px solid #e6e8ec;
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 1px 1px rgba(0, 0, 0, 0.04);
  transform-origin: bottom left;
  animation: pi-menu-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.slash-label {
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 425;
  color: #a1a1a1;
}
.slash-empty {
  padding: 6px 7px;
  font-size: 11px;
  color: #a1a1a1;
}

.enhancing-text {
  font-size: 12px;
  line-height: 18px;
  letter-spacing: -0.12px;
  word-break: break-word;
  color: transparent;
  -webkit-text-fill-color: transparent;
  background: linear-gradient(
    90deg,
    #1a1a1a 0%,
    #1a1a1a 30%,
    rgba(26, 26, 26, 0.45) 45%,
    rgba(26, 26, 26, 0.45) 55%,
    #1a1a1a 70%,
    #1a1a1a 100%
  );
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: pi-shine 2.25s cubic-bezier(0.25, 0.1, 0.25, 1) infinite;
}
@keyframes pi-shine {
  0%,
  18% {
    background-position: 100% 0;
  }
  82%,
  100% {
    background-position: 0% 0;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  /* tighten only the chips->text gap (frame gap is 12px) without touching the
     text->button-row gap */
  margin-bottom: -6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 3px 4px 3px 5px;
  border-radius: 999px;
  background: #ffffff;
  border: 0.5px solid #e6e8ec;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  color: #1a1a1a;
  font-size: 11px;
  line-height: 14px;
  animation: pi-chip-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
/* leave the same soft fade/scale way the skill pills do */
.chip[data-exit] {
  animation: pi-pill-out 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}
.chip-icon {
  display: inline-flex;
  flex: none;
  color: #a1a1a1;
}
.chip-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* pull 2px closer to the filename without changing the icon->text gap */
  margin-left: -2px;
  width: 15px;
  height: 15px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #a1a1a1;
  cursor: pointer;
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.chip-remove:hover {
  background: rgba(26, 26, 26, 0.08);
  color: #1a1a1a;
}
@keyframes pi-chip-in {
  from {
    opacity: 0;
    transform: translateY(4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.plus-wrap {
  position: relative;
  display: flex;
}
.right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
  border: 0;
  background: transparent;
  color: #1a1a1a;
  cursor: pointer;
}
.icon-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(26, 26, 26, 0.06);
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.icon-btn:hover::before {
  background: rgba(26, 26, 26, 0.1);
}
.icon-btn:active::before {
  transform: scale(0.98);
}
/* keep the icon above the (opaque, when active) ::before fill */
.icon-btn > svg {
  position: relative;
}

.plus-icon {
  position: relative;
  display: inline-flex;
  transition: transform 200ms cubic-bezier(0.35, 1.55, 0.65, 1);
}
.plus[data-open]::before {
  background: rgba(26, 26, 26, 0.12);
}
.plus[data-open] .plus-icon {
  transform: rotate(45deg);
}

.pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: #1a1a1a;
  font-size: 11px;
  line-height: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  animation: pi-pill-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.pill::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(26, 26, 26, 0.06);
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.pill:hover::before {
  background: rgba(26, 26, 26, 0.1);
}
.pill:active::before {
  transform: scale(0.98);
}
@keyframes pi-pill-in {
  from {
    opacity: 0;
    transform: scale(0.96);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}
/* symmetric exit — mirrors pi-pill-in so the enhance pill (and the inline
   skill pills) leave the same soft way they arrive */
@keyframes pi-pill-out {
  from {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
    filter: blur(2px);
  }
}
.pill.pill-exit {
  animation: pi-pill-out 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}

.send {
  color: #a1a1a1;
}
.send:disabled {
  cursor: default;
}
.send:disabled:active::before {
  transform: none;
}
.send-active {
  color: #ffffff;
}
.send-active::before {
  background: #0b0d12;
}
.send-active:hover::before {
  background: #2a2f3a;
}

.spinner-btn {
  cursor: default;
}
.spinner {
  position: relative;
  display: inline-flex;
  color: #a1a1a1;
  animation: pi-spin 0.7s linear infinite;
}
@keyframes pi-spin {
  to {
    transform: rotate(360deg);
  }
}

.menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  z-index: 20;
  width: 180px;
  padding: 3px;
  background: #ffffff;
  border: 0.5px solid #e6e8ec;
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 1px 1px rgba(0, 0, 0, 0.04);
  transform-origin: bottom left;
  animation: pi-menu-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 26px;
  padding: 0 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #1a1a1a;
  font-size: 11px;
  font-weight: 425;
  line-height: 12px;
  text-align: left;
  cursor: pointer;
}
.menu-item:hover {
  background: rgba(26, 26, 26, 0.06);
}
.menu-item:active {
  background: rgba(26, 26, 26, 0.09);
}
.menu-item.menu-item-active {
  background: rgba(26, 26, 26, 0.06);
}
.slash-menu[data-keyboard] .menu-item:hover {
  background: transparent;
}
.slash-menu[data-keyboard] .menu-item.menu-item-active,
.slash-menu[data-keyboard] .menu-item.menu-item-active:hover {
  background: rgba(26, 26, 26, 0.06);
}
.wrap svg {
  stroke-width: 1.5px;
}
.menu-icon {
  display: inline-flex;
  flex: none;
  color: #a1a1a1;
}
.menu-name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-check {
  display: inline-flex;
  flex: none;
  color: #1a1a1a;
}

/* Skills — a side flyout that expands from the "Skills" row */
.menu-sub {
  position: relative;
}
.menu-chevron {
  display: inline-flex;
  flex: none;
  color: #a1a1a1;
}
/* brand marks keep their own colours; ChatGPT is monochrome so it follows text */
.menu-brand {
  display: inline-flex;
  flex: none;
  color: #1a1a1a;
}
.menu-flyout {
  position: absolute;
  top: -3px;
  left: calc(100% + 6px);
  width: 168px;
  padding: 3px;
  background: #ffffff;
  border: 0.5px solid #e6e8ec;
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 1px 1px rgba(0, 0, 0, 0.04);
}
/* invisible bridge across the 6px gap so the hover doesn't drop when the
   pointer travels from the row into the flyout */
.menu-flyout::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: -7px;
  width: 7px;
}

/* model info popover — a non-interactive card shown on hover to the right */
.menu-popover {
  position: absolute;
  top: -3px;
  left: calc(100% + 6px);
  z-index: 30;
  width: 200px;
  padding: 10px 12px;
  background: #ffffff;
  border: 0.5px solid #e6e8ec;
  border-radius: 10px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 1px 1px rgba(0, 0, 0, 0.04);
  pointer-events: none;
}
.popover-title {
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  color: #1a1a1a;
}
.popover-desc {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 15px;
  color: #a1a1a1;
}
.popover-meta {
  margin-top: 8px;
  font-size: 11px;
  line-height: 14px;
  color: #a1a1a1;
}
.menu-divider {
  height: 0.5px;
  margin: 4px -3px;
  background: #e6e8ec;
}
.menu-label {
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 425;
  color: #a1a1a1;
}
@keyframes pi-menu-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@media (prefers-color-scheme: dark) {
  .frame {
    background: #1a1a1a;
    box-shadow:
      0 0 0 0.5px rgba(255, 255, 255, 0.12),
      0 1px 2px rgba(0, 0, 0, 0.4),
      0 2px 4px rgba(0, 0, 0, 0.3);
  }
  .frame[data-enhancing]::after {
    background: conic-gradient(from var(--pi-angle), #3b6fb5, #6b5aa6, #9a4f96, #3a8a9a, #3b6fb5)
      border-box;
  }
  .field {
    color: #f5f5f5;
  }
  .field::placeholder {
    color: #f5f5f5;
  }
  .enhancing-text {
    background: linear-gradient(
      90deg,
      #f5f5f5 0%,
      #f5f5f5 30%,
      rgba(245, 245, 245, 0.45) 45%,
      rgba(245, 245, 245, 0.45) 55%,
      #f5f5f5 70%,
      #f5f5f5 100%
    );
    background-size: 300% 100%;
    -webkit-background-clip: text;
    background-clip: text;
  }
  .chip {
    background: #1a1a1a;
    border-color: #303030;
    color: #f5f5f5;
  }
  .chip-icon {
    color: #a3a3a3;
  }
  .chip-remove {
    color: #a3a3a3;
  }
  .chip-remove:hover {
    background: rgba(245, 245, 245, 0.08);
    color: #f5f5f5;
  }
  .icon-btn {
    color: #f5f5f5;
  }
  .icon-btn::before {
    background: rgba(245, 245, 245, 0.06);
  }
  .icon-btn:hover::before {
    background: rgba(245, 245, 245, 0.1);
  }
  .plus[data-open]::before {
    background: rgba(245, 245, 245, 0.12);
  }
  .pill {
    color: #f5f5f5;
  }
  .pill::before {
    background: rgba(245, 245, 245, 0.06);
  }
  .pill:hover::before {
    background: rgba(245, 245, 245, 0.1);
  }
  .send-active {
    color: #0a0a0a;
  }
  .send-active::before {
    background: #f5f5f5;
  }
  .send-active:hover::before {
    background: #ffffff;
  }
  .spinner {
    color: #a3a3a3;
  }
  .menu {
    background: #1a1a1a;
    border-color: #303030;
  }
  .menu-item {
    color: #f5f5f5;
  }
  .menu-item:hover {
    background: rgba(245, 245, 245, 0.06);
  }
  .menu-item:active {
    background: rgba(245, 245, 245, 0.09);
  }
  .menu-icon {
    color: #a3a3a3;
  }
  .menu-check {
    color: #f5f5f5;
  }
  .menu-chevron {
    color: #a3a3a3;
  }
  .menu-brand {
    color: #f5f5f5;
  }
  .menu-divider {
    background: #303030;
  }
  .menu-label {
    color: #a3a3a3;
  }
  .menu-flyout {
    background: #1a1a1a;
    border-color: #303030;
  }
  .menu-popover {
    background: #1a1a1a;
    border-color: #303030;
  }
  .popover-title {
    color: #f5f5f5;
  }
  .popover-desc,
  .popover-meta {
    color: #a3a3a3;
  }
  :global(.skill-pill) {
    background: rgba(43, 127, 255, 0.22);
    color: #9ec5ff;
  }
  .slash-menu {
    background: #1a1a1a;
    border-color: #303030;
  }
  .slash-label,
  .slash-empty {
    color: #a3a3a3;
  }
  .menu-item.menu-item-active {
    background: rgba(245, 245, 245, 0.06);
  }
  .slash-menu[data-keyboard] .menu-item.menu-item-active,
  .slash-menu[data-keyboard] .menu-item.menu-item-active:hover {
    background: rgba(245, 245, 245, 0.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn::before,
  .pill::before,
  .menu-item,
  .chip-remove,
  .plus-icon,
  :global(.skill-pill) {
    transition: none;
  }
  .chip,
  .chip[data-exit],
  .pill,
  .pill.pill-exit,
  .menu,
  .menu-flyout,
  .menu-popover,
  .slash-menu {
    animation: none;
  }
  .enhancing-text,
  .frame[data-enhancing]::after {
    animation: none;
  }
  .spinner {
    animation-duration: 1.4s;
  }
}
</style>
