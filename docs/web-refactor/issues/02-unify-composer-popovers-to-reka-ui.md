# 02 — Composer 弹出菜单统一到 reka-ui

**What to build:** 模型选择器、思考强度选择和附件“+”菜单统一使用 reka-ui；保持现有视觉和选择行为，同时获得完整键盘导航、焦点管理、Escape 与外点关闭能力。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 三处弹层的打开、关闭、选择和视觉行为与现状一致
- [x] 三处弹层均可通过方向键、Enter 和 Escape 完整操作
- [x] 删除手写 document 级外点监听及对应清理逻辑
- [x] 供应商标记不再依赖不必要的 render function
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
