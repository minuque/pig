# 06 — Steer 当前 Running Run

**What to build:** 用户可以向所选 Session 当前 running Run 发送 Steer 纠偏；Steer 只影响该 Run，不创建普通后续 Run，也不会退化为排队 prompt。

**Blocked by:** 04 — 按 Session 调度 Run

**Status:** ready-for-agent

- [ ] 仅当目标 Session 存在当前 running Run 时允许发送 Steer。
- [ ] Steer 明确绑定当前 Session 和 Run ID，并由 Pi Runtime 接收。
- [ ] Steer 不创建新 Run、不进入 FIFO 队列，也不改变已冻结的 Execution Profile。
- [ ] 对 queued、cancelling、终态或非当前 Run 的 Steer 返回稳定且可操作的拒绝结果。
- [ ] Session 切换或 Run 终态竞态不会把 Steer 发送到其他 Run。
- [ ] 工作台清楚区分 Steer 与发送新 prompt 排队两种操作。
