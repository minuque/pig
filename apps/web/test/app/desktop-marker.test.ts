import { describe, expect, it } from "vitest";
import { applyDesktopPresentationMarker } from "../../src/desktop-marker.js";

function makeRoot(): HTMLElement {
  return { dataset: {} } as HTMLElement;
}

describe("applyDesktopPresentationMarker", () => {
  it("缺省 query 不写 dataset", () => {
    const root = makeRoot();
    applyDesktopPresentationMarker("http://127.0.0.1:5173/", root);
    expect(root.dataset.pigDesktopPlatform).toBeUndefined();
  });

  it("非法值不写 dataset", () => {
    for (const href of [
      "http://127.0.0.1:5173/?pig-desktop-platform=",
      "http://127.0.0.1:5173/?pig-desktop-platform=freebsd",
      "http://127.0.0.1:5173/?pig-desktop-platform=Darwin",
      "http://127.0.0.1:5173/?pig-desktop-platform=windows",
    ]) {
      const root = makeRoot();
      applyDesktopPresentationMarker(href, root);
      expect(root.dataset.pigDesktopPlatform).toBeUndefined();
    }
  });

  it.each(["darwin", "win32", "linux"] as const)("%s 写入桌面标记", (platform) => {
    const root = makeRoot();
    applyDesktopPresentationMarker(`http://127.0.0.1:5173/?pig-desktop-platform=${platform}`, root);
    expect(root.dataset.pigDesktopPlatform).toBe(platform);
  });
});
