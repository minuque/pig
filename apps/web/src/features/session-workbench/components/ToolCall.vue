<template>
  <div class="call">
    <div class="bar">
      <button type="button" class="toggle" :aria-expanded="open" @click="open = !open">
        <span class="caret" aria-hidden="true">▸</span>
        <component :is="icon" class="icon" :size="14" :style="{ color: tone }" aria-hidden="true" />
        <span class="name">{{ item.toolName || "工具" }}</span>
        <span v-if="inputLine" class="input">{{ inputLine }}</span>
      </button>
      <button type="button" class="copy" aria-label="复制" @click="copyPayload">
        <Copy :size="14" />
      </button>
    </div>
    <div v-if="open" class="body">
      <section v-if="inputFull" class="layer">
        <h3 class="label">入参</h3>
        <pre class="pre">{{ inputFull }}</pre>
      </section>
      <section v-if="outputText || outputImages.length" class="layer">
        <h3 class="label">输出</h3>
        <ExpandableText v-if="outputText" :text="outputText" />
        <div v-if="outputImages.length" class="images">
          <TranscriptImage
            v-for="(image, index) in outputImages"
            :key="index"
            :data="image.data"
            :mime-type="image.mimeType"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { Copy, FileText, Pencil, Search, Terminal, Wrench } from "lucide-vue-next";
import type { ToolTranscriptItem } from "@earendil-works/pi-protocol";
import ExpandableText from "@features/session-workbench/components/ExpandableText.vue";
import TranscriptImage from "@features/session-workbench/components/TranscriptImage.vue";
import {
  toolIconTone,
  transcriptImages,
  transcriptText,
} from "@features/session-workbench/lib/transcript-format.js";

const props = defineProps<{
  item: ToolTranscriptItem;
}>();

const open = shallowRef(false);
const inputLine = computed(() => JSON.stringify(props.item.input) ?? "");
const inputFull = computed(() => JSON.stringify(props.item.input, null, 2) ?? "");
const outputText = computed(() => transcriptText(props.item));
const outputImages = computed(() => transcriptImages(props.item));
const tone = computed(() => toolIconTone(props.item));
const icon = computed(() => {
  const name = props.item.toolName.toLowerCase();
  if (/(read|cat|open)/.test(name)) return FileText;
  if (/(write|edit|apply)/.test(name)) return Pencil;
  if (/(bash|shell|exec|cmd|pwsh)/.test(name)) return Terminal;
  if (/(grep|search|find)/.test(name)) return Search;
  return Wrench;
});

async function copyPayload() {
  const chunks = [inputFull.value, outputText.value].filter((chunk) => chunk.trim().length > 0);
  if (chunks.length === 0) return;
  try {
    await navigator.clipboard.writeText(chunks.join("\n\n"));
  } catch {
    // 剪贴板不可用时保持静默
  }
}
</script>

<style scoped>
.call {
  margin: 0 0 10px;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
}
.bar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: inherit;
  text-align: left;
}
.toggle:hover {
  color: var(--ink);
}
.toggle:not(:disabled):active {
  transform: none;
}
.caret {
  flex: none;
  font-size: 10px;
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.toggle[aria-expanded="true"] .caret {
  transform: rotate(90deg);
}
.icon {
  flex: none;
}
.name {
  flex: none;
  color: var(--ink-secondary);
  font-weight: var(--font-weight-medium);
}
.input {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.copy {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-height: 0;
  margin-inline-end: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}
.copy:hover {
  color: var(--ink);
}
.body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: 0 8px 8px;
}
.layer {
  min-width: 0;
}
.label {
  margin: 0 0 4px;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}
.pre {
  margin: 0;
  padding: var(--spacing-sm);
  overflow: auto;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.images {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    transition: none;
  }
}
</style>
