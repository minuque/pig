# 09 — Windows Packed Artifact Smoke Test

**What to build:** 发布前可以在 Windows 上从 npm packed artifact 执行隔离安装，并证明 Gateway 与构建后的 SPA 能从实际打包内容启动。

**Blocked by:** 08 — 落地日常可用工作台

**Status:** ready-for-agent

- [ ] smoke test 从新生成的 packed artifact 安装，不读取工作区源码来掩盖缺失文件。
- [ ] 安装后的命令可以启动仅监听 loopback 的 Gateway，并报告 Ready。
- [ ] Gateway 可以提供构建后的 SPA，核心入口请求成功且静态资源可加载。
- [ ] 测试完成后可靠终止子进程并清理临时目录，失败时保留足够但不含敏感内容的诊断。
- [ ] Windows 上的执行命令可重复运行，并纳入 Phase 1 验收流程。
- [ ] 本票不扩展为 Phase 3 的完整跨平台发布矩阵。
