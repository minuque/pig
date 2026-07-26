<script setup lang="ts">
import { ref, shallowRef, type VNodeChild, watch } from "vue";
import { VNodeSlot } from "@/components/VNodeSlot";
import {
  hastToVNodes,
  highlightToHast,
  normalizeLanguage,
} from "@/features/transcript/highlight";

/**
 * Fenced code block: raw code is always preserved verbatim; Shiki
 * highlighting (HAST → VNodes, never HTML strings) replaces the plain
 * fallback asynchronously once the language grammar loads. Unknown languages
 * stay plain. The copy button writes the raw code to the clipboard.
 */
const props = withDefaults(defineProps<{ code: string; language?: string }>(), {
  language: "",
});

const highlighted = shallowRef<VNodeChild[] | null>(null);
let loadSeq = 0;

watch(
  () => [props.code, props.language] as const,
  async ([code, language]) => {
    const seq = ++loadSeq;
    if (normalizeLanguage(language) === null) {
      highlighted.value = null;
      return;
    }
    try {
      const hast = await highlightToHast(code, language);
      if (seq !== loadSeq) return;
      highlighted.value = hast === null ? null : hastToVNodes(hast);
    } catch {
      if (seq === loadSeq) highlighted.value = null;
    }
  },
  { immediate: true },
);

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.code);
  } catch {
    return;
  }
  copied.value = true;
  if (copyTimer !== null) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
    copyTimer = null;
  }, 1500);
}
</script>

<template>
  <figure class="code-block">
    <figcaption class="code-block__bar">
      <span class="code-block__lang">{{
        language === "" ? "text" : language
      }}</span>
      <button
        type="button"
        class="code-block__copy"
        :aria-label="copied ? '已复制代码' : '复制代码'"
        @click="copy"
      >
        {{ copied ? "已复制" : "复制" }}
      </button>
    </figcaption>
    <pre v-if="highlighted === null"><code>{{ code }}</code></pre>
    <VNodeSlot v-else :nodes="highlighted" />
  </figure>
</template>
