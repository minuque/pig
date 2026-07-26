# 02 — 注册并授权 Workspace

**What to build:** 用户可预览候选目录规范化后的真实位置，明确确认 Workspace Grant，并查看已授权 Workspace。界面明确说明 Grant 只保护 Gateway 资源，不是 Pi 工具的操作系统沙箱。

**Blocked by:** 01 — 启动安全的打包工作台

**Status:** ready-for-agent

- [ ] Workspace 注册采用 preview/confirm 两阶段，preview 展示 realpath 规范化结果且不会自动授权 cwd。
- [ ] confirm 创建稳定 Workspace 与当前 Principal 的 Workspace Grant；路径别名和符号链接不能绕过按组件执行的包含关系校验。
- [ ] 未持有 Grant 的 Principal 无法列出或操作对应 Workspace 资源，且拒绝发生在 domain work 之前。
- [ ] UI 持续展示 Workspace Grant 不是 filesystem sandbox 的安全说明。
