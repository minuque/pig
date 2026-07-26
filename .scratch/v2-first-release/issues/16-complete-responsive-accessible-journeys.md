# 16 — 完成响应式与无障碍旅程

**What to build:** 用户可在桌面三区域 Workbench Shell 或窄屏 sheet/单面板流程中完成核心旅程，并使用浅色、深色、系统主题、键盘和辅助技术可靠操作。

**Blocked by:** 11 — 完成 Provider Auth Flow；15 — 并行操作多 Session

**Status:** ready-for-agent

- [ ] Workspace rail、Session sidebar 和 conversation panel 在桌面保持清晰所有权，窄屏转换为可导航 sheet 与单面板流程。
- [ ] Workspace、Session、Transcript、composer、dialog、sheet、tool detail 和 Auth Flow 可全程键盘操作，并正确管理 focus containment/return。
- [ ] 交互目标至少 44px，焦点可见，减少动效设置生效，浅色/深色/系统主题使用语义 token。
- [ ] streaming live region 不逐 token 过度播报，核心控件具有稳定语义名称。
- [ ] Chromium 核心旅程通过 keyboard-only、contrast 与 serious axe violation 门禁。
