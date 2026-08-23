import { useColorMode } from "@vueuse/core";
import { computed, nextTick } from "vue";

const STORAGE_KEY = "npg-theme";

/** 主题读写只放 theme 模块；其它 feature 只消费 isDark / toggle。 */
export function useColorScheme() {
  const mode = useColorMode({ initialValue: "light", storageKey: STORAGE_KEY });
  if (mode.store.value === "auto") mode.value = mode.system.value;

  const isDark = computed(() => mode.value === "dark");

  function toggle() {
    const updateTheme = () => {
      mode.value = isDark.value ? "light" : "dark";
    };

    if (
      typeof document === "undefined" ||
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      updateTheme();
      return;
    }

    document.startViewTransition(async () => {
      updateTheme();
      await nextTick();
    });
  }

  return { isDark, toggle };
}
