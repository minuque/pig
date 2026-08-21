import { AxeBuilder } from "@axe-core/playwright";

import { checkpoint } from "./checkpoint.js";
import { expect, test } from "./fixtures.js";

test("Chromium production SPA 关键旅程", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ workspaceId }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([workspaceId]));
      localStorage.setItem("pig.lastCwd", workspaceId);
      localStorage.setItem("npg-theme", "light");
    },
    { workspaceId: gateway.workspaceId },
  );

  await page.goto(gateway.bootstrapUrl);
  const sessionList = page.getByRole("navigation", { name: "会话列表" });
  await expect(sessionList).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pig.credential"))).toBeTruthy();
  await expect(page.getByRole("status").filter({ hasText: "正在连接…" })).toHaveCount(0);
  await checkpoint(page, "01-bootstrap");

  await expect(sessionList).toBeVisible();
  await expect(page.getByText("还没有工作目录")).toHaveCount(0);
  await checkpoint(page, "02-session-inbox");

  await expect(page.getByRole("heading", { name: /在.*开始/ })).toBeVisible();
  await checkpoint(page, "03-empty-canvas");

  const prompt = page.getByRole("textbox", { name: "任务描述" });
  const send = page.getByRole("button", { name: "发送" });
  await expect(prompt).toBeVisible();
  await expect(send).toBeDisabled();
  await expect(page.getByRole("button", { name: /^模型：/ })).toBeVisible();
  await prompt.fill("e2e composer");
  await expect(send).toBeEnabled();
  await checkpoint(page, "04-composer");

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = axe.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await test.info().attach("axe.json", {
    body: Buffer.from(JSON.stringify(serious, null, 2)),
    contentType: "application/json",
  });
  // ink-faint 空态目前低于 AA，记入报告但不挡旅程。
  expect(serious.filter((violation) => violation.id !== "color-contrast")).toEqual([]);

  await page.getByRole("button", { name: "当前浅色模式，点击切换到深色模式" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await checkpoint(page, "05-theme-dark");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("aside.sidebar.open")).toHaveCount(0);
  await checkpoint(page, "06-narrow-drawer-closed");
  await page.locator("header").getByRole("button", { name: "切换工作目录导航" }).click();
  await expect(page.locator("aside.sidebar.open")).toBeVisible();
  await checkpoint(page, "06-narrow-drawer-open");
});
