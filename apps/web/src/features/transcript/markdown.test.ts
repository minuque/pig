import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CodeBlock from "@/features/transcript/components/CodeBlock.vue";
import MarkdownView from "@/features/transcript/components/MarkdownView.vue";
import { DARK_TOKEN_COLOR_FIXES, LIGHT_TOKEN_COLOR_FIXES } from "@/features/transcript/highlight";
import { safeLinkHref } from "@/features/transcript/markdown";

describe("safeLinkHref", () => {
  it("allows http(s), mailto and document-relative links", () => {
    expect(safeLinkHref("https://example.com/x")).toBe("https://example.com/x");
    expect(safeLinkHref("http://example.com")).toBe("http://example.com");
    expect(safeLinkHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeLinkHref("#section")).toBe("#section");
    expect(safeLinkHref("/docs/page")).toBe("/docs/page");
    expect(safeLinkHref("./rel")).toBe("./rel");
  });

  it("rejects dangerous protocols and empty hrefs", () => {
    expect(safeLinkHref("javascript:alert(1)")).toBeNull();
    expect(safeLinkHref("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeLinkHref("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeLinkHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeLinkHref("")).toBeNull();
    expect(safeLinkHref("   ")).toBeNull();
  });
});

describe("MarkdownView safe rendering", () => {
  it("renders raw HTML as inert text, never as elements", () => {
    const wrapper = mount(MarkdownView, {
      props: { source: '<div onclick="alert(1)">hi</div>' },
    });
    expect(wrapper.find("[onclick]").exists()).toBe(false);
    expect(wrapper.text()).toContain('<div onclick="alert(1)">hi</div>');
  });

  it("never creates script elements (XSS)", () => {
    const wrapper = mount(MarkdownView, {
      props: {
        source: '<script>alert("xss")</script>\n\n<img src=x onerror=alert(1)>',
      },
    });
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain('alert("xss")');
  });

  it("renders dangerous links as plain text without an anchor", () => {
    const wrapper = mount(MarkdownView, {
      props: {
        source: "[xss](javascript:alert(1)) [data](data:text/html;base64,PHNjcmlwdD4=)",
      },
    });
    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.text()).toContain("xss");
    expect(wrapper.text()).toContain("data");
  });

  it("renders safe links with hardened anchor attributes", () => {
    const wrapper = mount(MarkdownView, {
      props: { source: "[docs](https://example.com/docs)" },
    });
    const link = wrapper.find("a");
    expect(link.exists()).toBe(true);
    expect(link.attributes("href")).toBe("https://example.com/docs");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toContain("noopener");
    expect(link.attributes("rel")).toContain("noreferrer");
  });

  it("never renders images; alt text is shown instead", () => {
    const wrapper = mount(MarkdownView, {
      props: { source: "![diagram](https://example.com/x.png)" },
    });
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain("[图片: diagram]");
  });

  it("preserves fenced code verbatim for unknown languages", () => {
    const wrapper = mount(MarkdownView, {
      props: { source: '```unknownlang\nconst a = 1 < 2 && "<b>";\n```' },
    });
    const code = wrapper.find("pre code");
    expect(code.exists()).toBe(true);
    expect(code.text()).toBe('const a = 1 < 2 && "<b>";');
  });

  it("renders inline code as text, not markup", () => {
    const wrapper = mount(MarkdownView, {
      props: { source: "run `rm <file>` now" },
    });
    const code = wrapper.find("code.md-inline-code");
    expect(code.exists()).toBe(true);
    expect(code.text()).toBe("rm <file>");
  });

  it("highlights known languages asynchronously into VNodes", async () => {
    const wrapper = mount(MarkdownView, {
      props: { source: "```js\nconst answer = 42;\n```" },
    });
    await vi.waitFor(
      () => {
        expect(wrapper.find("pre span").exists()).toBe(true);
      },
      { timeout: 10_000 },
    );
    expect(wrapper.text()).toContain("const answer = 42;");
    expect(wrapper.find("script").exists()).toBe(false);
  }, 15_000);
});

describe("fenced code raw model", () => {
  it("keeps the exact token content (trailing newline, multiple lines) as the code model", () => {
    const wrapper = mount(MarkdownView, {
      props: { source: "```unknownlang\nline1\nline2\n```" },
    });
    expect(wrapper.findComponent(CodeBlock).props("code")).toBe("line1\nline2\n");
    // Display is unchanged: exactly one trailing separator newline is
    // trimmed for rendering only, never from the model.
    expect(wrapper.find("pre code").text()).toBe("line1\nline2");
  });

  it("preserves interior blank lines verbatim", () => {
    const wrapper = mount(MarkdownView, {
      props: { source: "```text\na\n\nb\n```" },
    });
    expect(wrapper.findComponent(CodeBlock).props("code")).toBe("a\n\nb\n");
    expect(wrapper.find("pre code").text()).toBe("a\n\nb");
  });

  it("copies the exact raw code, including the trailing newline", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const wrapper = mount(MarkdownView, {
      props: { source: "```unknownlang\nconst a = 1 < 2;\n```" },
    });
    await wrapper.find(".code-block__copy").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith("const a = 1 < 2;\n");
  });
});

describe("Shiki token contrast (issue 16)", () => {
  const LIGHT_CODE_SURFACE = "#ecebe6";
  const DARK_CODE_SURFACE = "#111110";

  function relativeLuminance(hex: string): number {
    const channels = [1, 3, 5].map((index) => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  }

  function contrastRatio(foreground: string, background: string): number {
    const sorted = [relativeLuminance(foreground), relativeLuminance(background)].sort(
      (a, b) => b - a,
    );
    const lighter = sorted[0]!;
    const darker = sorted[1]!;
    return (lighter + 0.05) / (darker + 0.05);
  }

  it("maps every hard-to-read stock token color to an AA-readable tone", () => {
    // Stock github-light colors below 4.5:1 on the light code surface.
    const failingLight = [
      "#d73a49", // keyword / storage (axe hit: `const`)
      "#e36209", // variables
      "#22863a", // tags, regexp, escapes
      "#6a737d", // comments
      "#f6f8fa", // markup.ignored
      "#fafbfc", // carriage-return
    ];
    for (const color of failingLight) {
      expect(contrastRatio(color, LIGHT_CODE_SURFACE)).toBeLessThan(4.5);
      const fixed = LIGHT_TOKEN_COLOR_FIXES[color];
      expect(fixed, `light fix for ${color}`).toBeDefined();
      expect(contrastRatio(fixed!, LIGHT_CODE_SURFACE)).toBeGreaterThanOrEqual(4.5);
    }
    // Stock github-dark colors below 4.5:1 on the dark code surface.
    const failingDark = ["#6a737d", "#2f363d", "#24292e"];
    for (const color of failingDark) {
      expect(contrastRatio(color, DARK_CODE_SURFACE)).toBeLessThan(4.5);
      const fixed = DARK_TOKEN_COLOR_FIXES[color];
      expect(fixed, `dark fix for ${color}`).toBeDefined();
      expect(contrastRatio(fixed!, DARK_CODE_SURFACE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("renders TypeScript keywords with the remapped light token color", async () => {
    const wrapper = mount(MarkdownView, {
      props: { source: "```ts\nconst answer = 42;\n```" },
    });
    await vi.waitFor(
      () => {
        expect(wrapper.find(".code-block pre span").exists()).toBe(true);
      },
      { timeout: 10_000 },
    );
    const styles = wrapper
      .findAll(".code-block pre span")
      .map((span) => span.attributes("style") ?? "")
      .join(";")
      .toLowerCase();
    expect(styles).not.toContain("#d73a49");
    expect(styles).toContain(LIGHT_TOKEN_COLOR_FIXES["#d73a49"]!);
  }, 15_000);
});
