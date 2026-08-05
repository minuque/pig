# 10 — 清理重复解析与状态联动

**What to build:** 模型标识解析、模型切换后的 thinking level 修正和工具结果文本提取各自收敛为单一实现；选择组件只展示和上报用户输入，不再重复修正领域状态。

**Blocked by:** 02（Composer 弹出菜单统一到 reka-ui）

**Status:** ready-for-agent

- [x] 模型选择与预设绑定共用同一模型标识解析逻辑
- [x] 无分隔符或未知模型标识具有明确回退行为
- [x] thinking level 自动修正只保留在状态所有者中
- [x] 工具结果文本提取归入 Transcript 解析逻辑
- [x] 删除对应重复实现并补齐纯函数边界测试
- [x] typecheck 通过，vitest 全绿
