import { onBeforeUnmount, ref, type Ref } from "vue";

/**
 * Reactive media query. Degrades to `false` (desktop layout) when matchMedia
 * is unavailable (e.g. test environments), so the canonical desktop shell is
 * the resilient default.
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false);
  if (typeof window.matchMedia === "function") {
    const mql = window.matchMedia(query);
    matches.value = mql.matches;
    const onChange = (event: MediaQueryListEvent) => {
      matches.value = event.matches;
    };
    mql.addEventListener("change", onChange);
    onBeforeUnmount(() => mql.removeEventListener("change", onChange));
  }
  return matches;
}
