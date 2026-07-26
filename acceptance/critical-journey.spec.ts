import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";

const connected = (page: import("@playwright/test").Page) =>
  page.getByRole("status").filter({ hasText: "已连接" });

test("Chromium packaged critical journey is persistent, responsive, and accessible", async ({
  page,
  gateway,
}) => {
  await page.goto(gateway.bootstrapUrl);
  await expect(connected(page)).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("bootstrap=");

  const registerTrigger = page.getByRole("button", { name: "注册工作区" });
  await registerTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "注册工作区" })).toBeFocused();
  await page.getByLabel("工作区路径").fill(gateway.workspaceDir);
  await page.keyboard.press("Enter");
  await expect(page.getByText("规范化根路径")).toBeVisible();
  await page.getByLabel("显示名称").fill("Release workspace");
  await page.getByRole("button", { name: "确认注册" }).click();
  await expect(page).toHaveURL(/#\/workspaces\//);

  await page.getByLabel("新会话名称").fill("Persistent session");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sessions\//);
  await expect(page.getByLabel("输入 Prompt")).toBeEnabled();
  await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();
  await page.getByLabel("输入 Prompt").fill("deterministic draft");
  await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();

  const theme = page.getByLabel("主题");
  await theme.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await theme.selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await theme.selectOption("system");

  const serious = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    serious.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  const undersized = await page
    .locator(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            (rect.width < 44 || rect.height < 44)
          );
        })
        .map((element) => ({
          name:
            element.getAttribute("aria-label") ?? element.textContent?.trim(),
          rect: element.getBoundingClientRect().toJSON(),
        })),
    );
  expect(undersized).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const workspaceButton = page.getByRole("button", {
    name: "工作区",
    exact: true,
  });
  await workspaceButton.click();
  const sheet = page.getByRole("dialog", { name: "工作区" });
  await expect(sheet).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(workspaceButton).toBeFocused();

  await gateway.restart();
  await page.goto(gateway.bootstrapUrl);
  await expect(connected(page)).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("bootstrap=");
  await page.getByRole("button", { name: "工作区", exact: true }).click();
  await page
    .getByRole("button", { name: "Release workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "会话", exact: true }).click();
  await expect(
    page.getByText("Persistent session", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Persistent session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sessions\//);
  await expect(page.getByLabel("输入 Prompt")).toBeEnabled();
});
