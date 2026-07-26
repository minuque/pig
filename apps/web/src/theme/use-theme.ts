import { ref, watch } from "vue";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "npng-theme";

const preference = ref<ThemePreference>(readStoredPreference());

let media: MediaQueryList | null = null;
let applied = false;

function readStoredPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

function resolvedTheme(): "light" | "dark" {
  if (preference.value !== "system") return preference.value;
  if (typeof window.matchMedia !== "function") return "light";
  media ??= window.matchMedia("(prefers-color-scheme: dark)");
  return media.matches ? "dark" : "light";
}

function apply(): void {
  document.documentElement.dataset.theme = resolvedTheme();
}

/**
 * Theme is a UI preference (never a durable fact): light, dark, or system.
 * It resolves onto `data-theme` on <html>, which the token CSS consumes.
 */
export function useTheme() {
  if (!applied) {
    applied = true;
    if (typeof window.matchMedia === "function") {
      media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", apply);
    }
    apply();
    watch(preference, (value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch {
        /* storage unavailable */
      }
      apply();
    });
  }
  const setTheme = (value: ThemePreference) => {
    preference.value = value;
  };
  return { preference, setTheme };
}
