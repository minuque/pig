import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MarkdownView from "@/features/transcript/components/MarkdownView.vue";
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
