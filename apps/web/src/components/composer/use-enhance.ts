import { computed, ref } from "vue";

export type EnhancePhase = "idle" | "enhancing" | "enhanced";

/**
 * Enhance 状态机：enhancing（shimmer）→ enhanced（Revert 可用）；失败回退原文。
 * 组件负责把 pendingHTML 写入编辑器并管理 DOM 动画；用户编辑增强结果后由组件将 phase 复位。
 */
export function useEnhance(onEnhance: (prompt: string, signal?: AbortSignal) => Promise<string>) {
  const phase = ref<EnhancePhase>("idle");
  const enhancing = computed(() => phase.value === "enhancing");
  /** 增强结果（原文或失败回退原文）；组件写入编辑器后置 null */
  const pendingHTML = ref<string | null>(null);
  let preEnhanceHTML = "";
  let abort: AbortController | null = null;

  async function enhance(prompt: string) {
    if (!prompt.trim() || enhancing.value) return;
    preEnhanceHTML = prompt;
    phase.value = "enhancing";
    const ac = new AbortController();
    abort = ac;
    try {
      const result = await onEnhance(prompt, ac.signal);
      if (ac.signal.aborted) return;
      pendingHTML.value = result;
      phase.value = "enhanced";
    } catch {
      if (ac.signal.aborted) return;
      pendingHTML.value = preEnhanceHTML; // 失败回退原文
      phase.value = "idle";
    }
  }
  function revert() {
    abort?.abort();
    pendingHTML.value = preEnhanceHTML;
    phase.value = "idle";
  }
  function dispose() {
    abort?.abort();
  }
  return { phase, enhancing, pendingHTML, enhance, revert, dispose };
}
