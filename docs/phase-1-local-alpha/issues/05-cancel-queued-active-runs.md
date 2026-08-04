# 05 — 取消 Queued 与 Active Run

**What to build:** 用户可以取消排队中或执行中的 Run，并从工作台看到即时、确定且不误伤其他 Run 的状态变化。

**Blocked by:** 04 — 按 Session 调度 Run

**Status:** ready-for-agent

- [ ] 取消 Queued Run 会将其从队列移除并收敛到 Cancelled，不启动 Pi 执行。
- [ ] 取消 active Run 会先展示 Cancelling，再收敛到 Cancelled 或已经发生的真实终态。
- [ ] 取消一个 Run 不影响同 Session 的其他 queued Run，也不影响其他 Session。
- [ ] active Run 终止后，同一 Session 的下一个 queued Run 可以继续调度。
- [ ] 重复取消和终态竞态返回稳定结果，不产生第二次副作用。
- [ ] 确定性测试覆盖 queued、active、重复取消和完成竞态。
