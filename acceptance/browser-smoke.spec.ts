import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

async function bootstrap(page: Page, url: string) {
  await page.goto(url);
  await expect(
    page.getByRole("status").filter({ hasText: "已连接" }),
  ).toBeVisible();
  await expect.poll(() => page.url()).not.toContain("bootstrap=");
}

test("packed Gateway bootstrap, SSE, and composer smoke", async ({
  page,
  gateway,
}) => {
  await bootstrap(page, gateway.bootstrapUrl);
  await expect(page.getByText("No Pi No Gang")).toBeVisible();

  await page.getByRole("button", { name: "注册工作区" }).click();
  await page.getByLabel("工作区路径").fill(gateway.workspaceDir);
  await page.getByRole("button", { name: "预览路径" }).click();
  await expect(
    page.getByText("Gateway access only; not a filesystem sandbox"),
  ).toBeVisible();
  await page.getByLabel("显示名称").fill(`Browser ${test.info().project.name}`);
  await page.getByRole("button", { name: "确认注册" }).click();

  await page.getByLabel("新会话名称").fill(`Smoke ${test.info().project.name}`);
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page.getByLabel("输入 Prompt")).toBeEnabled();
  await page.getByLabel("输入 Prompt").fill("composer is usable");
  await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();
});
