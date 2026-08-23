import { afterEach, describe, expect, it, vi } from "vitest";
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js";

vi.mock("@vueuse/core", async () => {
  const { shallowRef } = await import("vue");

  return {
    useColorMode: () =>
      Object.assign(shallowRef("light"), {
        store: shallowRef("light"),
        system: shallowRef("light"),
      }),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useColorScheme", () => {
  it("switches the theme inside a view transition", () => {
    const startViewTransition = vi.fn((update: () => void) => update());
    vi.stubGlobal("document", { startViewTransition });
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: false })) });
    const { isDark, toggle } = useColorScheme();

    toggle();

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(isDark.value).toBe(true);
  });

  it("switches immediately when view transitions are unavailable", () => {
    vi.stubGlobal("document", {});
    const { isDark, toggle } = useColorScheme();

    toggle();

    expect(isDark.value).toBe(true);
  });

  it("switches immediately when reduced motion is requested", () => {
    const startViewTransition = vi.fn((update: () => void) => update());
    vi.stubGlobal("document", { startViewTransition });
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: true })) });
    const { isDark, toggle } = useColorScheme();

    toggle();

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(isDark.value).toBe(true);
  });
});
