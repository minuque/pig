# 04 — 按 Session 调度 Run

**What to build:** 用户可以连续提交 Run；同一 Session 严格按 FIFO 串行执行，不同 Session 在配置的全局上限内并行，工作台准确展示排队与执行状态。

**Blocked by:** 03 — Pi Runtime Execution Profile

**Status:** ready-for-agent

- [ ] 每个 Session 同时最多一个 active Run，后续 Run 按 admission 顺序进入 Queued。
- [ ] 当前 Run 到达终态后，同一 Session 的队首 Run 自动开始且顺序确定。
- [ ] 不同 Session 的 Run 可以并行，但 running 总数不超过配置上限。
- [ ] 每个 queued Run 使用 admission 时冻结的 Execution Profile。
- [ ] 工作台按 Session 和稳定 Run ID 展示 Queued、Running 及终态，不混淆并行 Run。
- [ ] 确定性测试覆盖同 Session FIFO、跨 Session 并行和全局容量释放。
