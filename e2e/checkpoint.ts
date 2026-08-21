import { test, type Page } from "@playwright/test";

/** 检查点 id → 验收单描述列。与 critical-journey 一一对应。 */
export const CHECKPOINT_COPY = {
  "01-bootstrap": "兑换凭证，工作台可见，连接完成",
  "02-session-inbox": "侧栏已授权工作目录，会话列表就绪",
  "03-empty-canvas": "空 Session 欢迎句：在该目录开始",
  "04-composer": "空正文发送禁用，填字后可发送",
  "05-theme-dark": "切到深色模式",
  "06-narrow-drawer-closed": "390 宽，左栏收成抽屉",
  "06-narrow-drawer-open": "打开导航抽屉",
} as const;

export type CheckpointName = keyof typeof CHECKPOINT_COPY;

/** 把当前页作为命名验收截图挂到本次测试，供 HTML 报告与 e2e-report 使用。 */
export async function checkpoint(page: Page, name: CheckpointName) {
  const body = await page.screenshot({ animations: "disabled" });
  await test.info().attach(name, { body, contentType: "image/png" });
}
