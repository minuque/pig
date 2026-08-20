import { describe, expect, it } from "vitest";
import { stripNativeMenu, windowChromeFor } from "../src/main/window-chrome.js";

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

describe("windowChromeFor", () => {
  it("darwin 使用 hiddenInset，无 vibrancy", () => {
    expect(windowChromeFor("darwin")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 18 },
      webPreferences: SECURE_WEB_PREFERENCES,
    });
  });

  it("win32 使用 hidden overlay，无 acrylic", () => {
    expect(windowChromeFor("win32")).toEqual({
      titleBarStyle: "hidden",
      titleBarOverlay: { color: "#00000000", symbolColor: "#7f858f", height: 44 },
      thickFrame: true,
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences: SECURE_WEB_PREFERENCES,
    });
  });

  it("linux 无框不透明", () => {
    expect(windowChromeFor("linux")).toEqual({
      frame: false,
      webPreferences: SECURE_WEB_PREFERENCES,
    });
  });

  it("未知平台只保留安全 webPreferences", () => {
    expect(windowChromeFor("freebsd")).toEqual({
      webPreferences: SECURE_WEB_PREFERENCES,
    });
  });

  it("stripNativeMenu 去掉窗口菜单", () => {
    const calls: string[] = [];
    stripNativeMenu({
      setMenu(menu) {
        expect(menu).toBeNull();
        calls.push("menu");
      },
      setMenuBarVisibility(visible) {
        expect(visible).toBe(false);
        calls.push("bar");
      },
    });
    expect(calls).toEqual(["menu", "bar"]);
  });
});
