# 17 — 提供安全诊断和可靠进程生命周期

**What to build:** 用户可通过最小 health probes、白名单日志、崩溃标记和可操作状态判断 Gateway 是否可用及如何恢复；Gateway 可在预算内安全关闭，不泄漏 prompt、路径、credential 或工具内容。

**Blocked by:** 05 — 保证 Run 幂等与崩溃恢复；08 — 恢复断线的实时状态；14 — 隔离异常 Session 源

**Status:** ready-for-agent

- [ ] liveness 只表示进程存活；readiness 用有限稳定代码区分启动、migration、reconciliation、ready 与 shutdown。
- [ ] Safe Diagnostic Event 只接受声明字段，日志按最旧 segment 轮换且总量不超过 50 MiB。
- [ ] prompt、Transcript、工具 payload、路径、header、cookie、token、环境值、raw URL 和未知异常 message 的 canary 不出现在日志、health 或 crash marker。
- [ ] 非正常退出留下最小安全 fingerprint，并在下一次启动触发恢复检查。
- [ ] shutdown 依次停止准入、处理中断 queued Run、并发取消 active Run、关闭 SSE/Runtime/SQLite 并释放锁，遵守十秒排空与十五秒进程预算。
