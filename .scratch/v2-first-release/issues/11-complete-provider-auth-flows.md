# 11 — 完成 Provider Auth Flow

**What to build:** 用户可完成 Pi provider 发起的 browser OAuth、device code、prompt 或 select Auth Flow；敏感输入只在当前组件短暂存在，并在提交、取消、过期或 Gateway 重启后安全终止。

**Blocked by:** 01 — 启动安全的打包工作台；10 — 选择并冻结 Execution Profile

**Status:** ready-for-agent

- [ ] Auth Flow 以版本化资源表达 open URL、device code、prompt 和 select 等交互。
- [ ] API key、OAuth 答案及其他敏感输入为 write-only，不进入 Query、Pinia、devtools、日志或任何 API 响应。
- [ ] 提交或取消后组件立即清除敏感值；过期与 Gateway 重启使旧 Auth Flow 不可继续。
- [ ] 用户可从模型不可用状态进入对应 Auth Flow，并在认证完成后重新取得实际 capability。
- [ ] canary 扫描证明 credential 不出现在持久文件、诊断表面或浏览器共享状态中。
