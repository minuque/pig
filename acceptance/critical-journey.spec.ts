import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const connected = (page: Page) => page.getByRole("status").filter({ hasText: "已连接" });

async function activate(page: Page, locator: Locator): Promise<void> {
  await locator.focus();
  await page.keyboard.press("Enter");
}

async function typeWithKeyboard(
  page: Page,
  locator: Locator,
  value: string,
  submit = false,
): Promise<void> {
  await locator.focus();
  await page.keyboard.insertText(value);
  if (submit) await page.keyboard.press("Enter");
}

test("Chromium packaged critical journey is persistent, responsive, and accessible", async ({
  page,
  gateway,
}) => {
  await page.goto(gateway.bootstrapUrl);
  await expect(connected(page)).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("bootstrap=");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });

  const registerTrigger = page.getByRole("button", { name: "注册工作区" });
  await activate(page, registerTrigger);
  await expect(page.getByRole("dialog", { name: "注册工作区" })).toBeFocused();
  await typeWithKeyboard(page, page.getByLabel("工作区路径"), gateway.workspaceDir, true);
  await expect(page.getByText("规范化根路径")).toBeVisible();
  await typeWithKeyboard(page, page.getByLabel("显示名称"), "Release workspace");
  await activate(page, page.getByRole("button", { name: "确认注册" }));
  await expect(page).toHaveURL(/#\/workspaces\//);

  await typeWithKeyboard(page, page.getByLabel("新会话名称"), "Persistent session", true);
  await expect(page).toHaveURL(/\/sessions\//);
  const composer = page.getByLabel("输入 Prompt");
  await expect(composer).toBeEnabled();
  await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();
  await typeWithKeyboard(page, composer, "first packaged streaming Run", true);

  const liveOutput = page.getByRole("article", { name: "进行中的输出" });
  await expect(liveOutput).toContainText("Release");
  await page.context().setOffline(true);
  await page.waitForTimeout(400);
  await page.context().setOffline(false);
  await expect(connected(page)).toBeVisible();
  const assistantOutput = page
    .getByRole("article", { name: "助手消息" })
    .filter({ hasText: "Release stream complete." });
  await expect(assistantOutput).toBeVisible();
  await expect(liveOutput).toHaveCount(0);
  const copyCode = page.getByRole("button", { name: "复制代码" });
  await activate(page, copyCode);
  await expect(page.getByRole("button", { name: "已复制代码" })).toBeVisible();

  await typeWithKeyboard(page, composer, "draft retained for first session");
  await typeWithKeyboard(page, page.getByLabel("新会话名称"), "Parallel session", true);
  await expect(page.getByRole("button", { name: "Parallel session", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const parallelComposer = page.getByLabel("输入 Prompt");
  await typeWithKeyboard(page, parallelComposer, "draft retained for parallel session");

  await activate(page, page.getByRole("button", { name: "Persistent session", exact: true }));
  await expect(page.getByLabel("输入 Prompt")).toHaveValue("draft retained for first session");
  await page.getByLabel("输入 Prompt").press("Enter");
  await activate(page, page.getByRole("button", { name: "Parallel session", exact: true }));
  await expect(page.getByLabel("输入 Prompt")).toHaveValue("draft retained for parallel session");
  await page.getByLabel("输入 Prompt").press("Enter");
  await expect(
    page
      .getByRole("article", { name: "用户消息" })
      .filter({ hasText: "draft retained for parallel session" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "助手消息" }).filter({ hasText: "Release stream complete." }),
  ).toBeVisible();

  await activate(page, page.getByRole("button", { name: "Persistent session", exact: true }));
  await expect(
    page
      .getByRole("article", { name: "用户消息" })
      .filter({ hasText: "draft retained for first session" }),
  ).toBeVisible();

  const authTrigger = page.getByRole("button", { name: "Provider 授权" });
  await activate(page, authTrigger);
  const authDialog = page.getByRole("dialog", { name: "Provider 授权" });
  await expect(authDialog).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(authDialog).toBeHidden();
  await expect(authTrigger).toBeFocused();

  const theme = page.getByLabel("主题");
  await theme.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Home");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("End");

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
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map((element) => ({
          name: element.getAttribute("aria-label") ?? element.textContent?.trim(),
          rect: element.getBoundingClientRect().toJSON(),
        })),
    );
  expect(undersized).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const workspaceButton = page.getByRole("button", {
    name: "工作区",
    exact: true,
  });
  await activate(page, workspaceButton);
  const sheet = page.getByRole("dialog", { name: "工作区" });
  await expect(sheet).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(workspaceButton).toBeFocused();

  await gateway.restart();
  await page.goto(gateway.bootstrapUrl);
  await expect(connected(page)).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("bootstrap=");
  await activate(page, page.getByRole("button", { name: "工作区", exact: true }));
  await activate(page, page.getByRole("button", { name: "Release workspace", exact: true }));
  await activate(page, page.getByRole("button", { name: "会话", exact: true }));
  await expect(page.getByText("Persistent session", { exact: true })).toBeVisible();
  await activate(page, page.getByRole("button", { name: "Persistent session", exact: true }));
  await expect(page).toHaveURL(/\/sessions\//);
  await expect(
    page
      .getByRole("article", { name: "用户消息" })
      .filter({ hasText: "draft retained for first session" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "助手消息" }).filter({ hasText: "Release stream complete." }),
  ).toBeVisible();
});
