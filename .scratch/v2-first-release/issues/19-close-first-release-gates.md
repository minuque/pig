# 19 — 封闭首发发布门禁

**What to build:** 维护者可从 clean checkout 构建唯一 packed artifact，并用公开契约、用户可见行为和持久文件所有权证明首发在支持的平台、Node 版本和 Pi 版本上可安全发布与恢复。

**Blocked by:** 07 — Steer 和取消 Run；11 — 完成 Provider Auth Flow；13 — 安全删除 Session 和撤销 Grant；14 — 隔离异常 Session 源；16 — 完成响应式与无障碍旅程；18 — 保护升级和显式恢复

**Status:** ready-for-agent

- [ ] Linux 从 packed artifact 通过全部 critical scenario，且没有无法解释的 skip、quarantined flaky test 或靠简单重跑掩盖的首次失败。
- [ ] Windows 与 macOS 从同一 tarball 通过安装、Node gate、native data root、实例锁、bootstrap、临时 Workspace、真实 Pi Session 创建/重开、SQLite restart persistence 和 bounded shutdown smoke。
- [ ] 最低 Node 22.19.0 与当前支持 LTS 均通过 release CI；未覆盖的新 Node 版本不声明支持。
- [ ] 固定的真实 Pi 包可在隔离 Agent Root 创建和重开 Session；上一支持 Pi 不能读取候选版本写入 fixture 时形成 Rollback Barrier 并阻止普通发布。
- [ ] Chromium 通过首发完整旅程，Firefox/WebKit 通过 bootstrap、SSE 和 composer smoke；发布验证只断言公共资源、事件、DOM、文件所有权、退出与恢复行为。
