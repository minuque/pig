# 01 — 持久化多 Workspace Access

**What to build:** 用户可以为稳定的 Local Identity 注册、预览、确认、切换和取消多个 Workspace Access；授权跨 Gateway 重启保持，取消后相关资源立即不能被新请求访问。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 同一 Local Identity 可以持有并切换多个 canonical Workspace 根，重复注册不会产生重复资源。
- [ ] Workspace Access 只有在用户确认后生效，取消或放弃预览不会留下授权。
- [ ] Local Identity、Workspace Access 和必要元数据保存到 SQLite，并在 Gateway 重启后保持一致。
- [ ] 取消 Workspace Access 后，新的 Workspace、Session 和 Run 请求均返回稳定的拒绝结果，其他 Workspace 不受影响。
- [ ] SQLite 不保存 Pi 会话记录（Transcript）、实时增量或工具 payload。
