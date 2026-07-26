# 10 — 选择并冻结 Execution Profile

**What to build:** 用户可查看 Pi 实际提供的模型并为 prompt 选择模型与 thinking level；选择在 Run admission 时冻结，之后的 UI 或 Session 变化不会改变 queued/running Run。

**Blocked by:** 04 — 完成首个流式 Run

**Status:** ready-for-agent

- [ ] 模型资源来自固定版本 Pi 的实际 capability，并通过版本化浏览器安全契约返回。
- [ ] composer 可选择模型和受支持的 thinking level，并清楚显示不可用 capability。
- [ ] Run admission 持久化不可变 Execution Profile，queued/running Run 始终展示所冻结的值。
- [ ] 模型列表刷新或用户后续选择不会修改已接纳 Run。
- [ ] 契约、Gateway integration 与浏览器测试覆盖支持、不支持和变更中的 Execution Profile。
