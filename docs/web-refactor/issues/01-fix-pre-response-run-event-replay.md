# 01 — 修复 Run 预响应事件重放

**What to build:** 当 Run 事件早于创建请求响应到达时，客户端仍能按顺序接收并应用这些事件，使 Run 从 queued 正常推进到 running 和终态，并在结束后刷新 Transcript。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] 预响应事件不会被 sequence 去重逻辑误丢弃
- [x] Run 能从 queued 正常推进到 running、completed、failed 或 cancelled
- [x] Run 到达终态后 Transcript 正常刷新
- [x] 增加“事件先于创建响应”的自动化回归测试
- [x] typecheck 通过，vitest 全绿
