# 08 — 恢复断线的实时状态

**What to build:** 浏览器断线后可从 Gateway 游标补齐遗漏事件；重复、乱序、缺口、epoch 变化或慢客户端背压不会让界面在未知状态上继续归约，而会安全去重或通过 reset 与验证后的 snapshot 恢复。

**Blocked by:** 04 — 完成首个流式 Run；05 — 保证 Run 幂等与崩溃恢复

**Status:** ready-for-agent

- [ ] SSE bootstrap snapshot 与捕获游标形成无遗漏恢复边界。
- [ ] Sync Controller 对重复和已应用事件无害，并检测乱序、sequence gap 与 epoch mismatch。
- [ ] 事件历史过旧、Gateway 重启或背压越界时发送 reset，客户端只用验证后的 snapshot 整体替换 Live Overlay。
- [ ] 每个 SSE 客户端具有有界待发送队列，Gateway 不声称持久保存 token delta 或知道客户端应用进度。
- [ ] 真实断线/重连测试覆盖多 Session 事件、Gateway restart、slow client 与 snapshot replacement。
