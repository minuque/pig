# e2e 的 Playwright 配置

- 状态：已采纳
- 代码：`e2e/playwright.config.ts`

## 背景

`e2e/` 跑整页浏览器旅程，文件间并行、文件内串行。桌面壳冒烟不在主配置里跑，它有自己的 `e2e/electron/playwright.config.ts` 和 webServer。

## 决定

### 截图对比容忍 200 像素

`toHaveScreenshot.maxDiffPixels` 设 200。零容忍会把抗锯齿与字体渲染抖动算成失败，而真变化在 200 像素内也看不出来。

### 4 个 worker

`workers: 4`。实测 32 条用例从 38.0s 降到 19.1s。

### CI 上重试两次

CI 上 `retries: 2`：偶发失败不挡合并，报告里标成 flaky 再单独修。本地不重试，失败立刻看到。

### 永远禁止 test.only

`forbidOnly` 常开，不看 `process.env.CI`。本地漏下的 `test.only` 溜进 pre-push 或 CI 就只跑了一条。

## 后果

- CI 上偶发失败会被重试掩盖，要看报告里的 flaky 标记单独修。
- 加 worker 前先量总时长：再多会和 Gateway 启动、web 构建抢核。
