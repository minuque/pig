# 08 — Transcript、Run UI 与安全渲染

**阶段：** Phase 0  
**父级场景：** AS-4、AS-5、AS-6、AS-9、AS-10  
**前置阻塞：** 06、07  
**状态：** 未满足

## 交付范围

完成 Transcript、Prompt 输入、Streaming、Cancel 和正式 Run 状态 UI；按稳定身份路由事件，并安全渲染 Markdown、代码和链接。

## 验收标准

- [ ] 当前 Session 页面显示 Transcript、Prompt 输入、发送与 Cancel；流式内容在原位置更新，不为每个 token 创建独立视觉元素。
- [ ] Workspace、Session、Run 状态按稳定 ID 规范化；SSE 事件按信封 ID 路由，切换页面不会混入其他 Session 的输出。
- [ ] UI 明确展示 running、completed、failed、cancelled；active Run 存在时发送被禁用并说明原因，Cancel 仅在适用时可用。
- [ ] Run 终态后重新请求 Session Transcript，以 Pi JSONL durable 内容替换对应瞬时流式状态。
- [ ] Markdown、代码和链接按不可信输入处理；模型 HTML、脚本、事件属性和危险 URL 不执行。
- [ ] 核心 Prompt/Cancel 流程键盘可达、焦点可见；实时 token 不逐个触发屏幕阅读器公告。

## 不在本票

Steer、队列、完整草稿隔离、虚拟滚动、raw HTML、完整主题与视觉发布门禁。

## 当前实现证据

- `packages/web/src/App.vue` 仅包含硬编码 Transcript、Prompt 输入和 Send 按钮的静态外观。
- 缺失 API/SSE 状态、稳定 ID 路由、Run 状态、Cancel、终态重载、安全 Markdown 渲染和实时无障碍处理。
- 原型目录不属于生产 Vue 实现；当前无验收项可勾选。
