# 09 — Phase 0 安全审计与验收门禁

**阶段：** Phase 0  
**父级场景：** AS-1 至 AS-10、全部 Exit Criteria  
**前置阻塞：** 01–08  
**状态：** 满足

## 交付范围

本票只负责集成验证和证据归档，不重新实现前序能力。逐项证明 Phase 0 的 10 个 Acceptance Scenarios、Foundation Constraints、Required Invariants 和 Exit Criteria。

## 验收标准

- [x] 建立 AS-1 至 AS-10 的追踪矩阵；每项关联自动化测试，或记录可重复命令、环境、期望结果和实际结果。
- [x] 敏感 canary 验证日志不含 credential、完整 prompt、Transcript 和工具 payload；Gateway 仅监听随机 loopback。
- [x] 架构检查证明包依赖、Pi Adapter、Repository、Session Index、平台路径、授权和策略边界符合 Phase 0 Foundation Constraints。
- [x] 端到端验证覆盖 `Workspace → Session → Prompt → Streaming → terminal Transcript reload`、Cancel 后新 Run、并发拒绝、进程内 mutation 幂等和 Gateway 重启发现。
- [x] 安全渲染测试证明模型 HTML 不会作为受信任 HTML 执行，并覆盖危险链接/事件属性。
- [x] 验收证据证明未依赖 Phase 1+ 能力；Deferred 项未被作为 Phase 0 契约引入。

## 场景追踪

统一环境：Windows 11、Node `v24.9.0`、pnpm `11.5.0`。统一命令：仓库根目录执行 `pnpm test`；期望全部测试通过；实际 Gateway 5 files/12 tests、Web 2 files/3 tests 全部通过。

| 场景  | 主要责任票 | 自动化证据                                                                                                                                                                  | 实际结果                                                           |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| AS-1  | 01         | `phase-zero-acceptance.test.ts`：随机端口、唯一 `listen(0, "127.0.0.1")` 路径；`workspace-access.test.ts`：本地 HTTP 启动                                                   | 通过                                                               |
| AS-2  | 01         | `phase-zero-acceptance.test.ts`：bootstrap 单次使用及 bootstrap/credential/prompt/transcript/tool canary 日志检查                                                           | 通过，捕获 `console.log/info/warn/error` 无 canary                 |
| AS-3  | 03、04、07 | `workspace-access.test.ts`：preview/confirm/Access；`session-resources.test.ts`：Session 创建/打开；`api.test.ts`：可操作错误                                               | 通过                                                               |
| AS-4  | 04、06、08 | `phase-zero-acceptance.test.ts`：Workspace→Session→Prompt→SSE→terminal→durable Transcript reload                                                                            | 通过，delta 与 terminal 均按稳定 ID 归属，Transcript 从 JSONL 重读 |
| AS-5  | 06、08     | `streaming-cancel.test.ts`：Cancel、晚到事件、终态竞态；`run-state.test.ts`：终态触发 reload                                                                                | 通过                                                               |
| AS-6  | 05、08     | `run-lifecycle.test.ts`：全局并发拒绝且不调用 Pi、settled 后新 Run；`App.vue` active Run 门控由 typecheck/lint 覆盖                                                         | 通过                                                               |
| AS-7  | 02、04     | `session-resources.test.ts`：Gateway stop/start 后列表、打开、Transcript；`phase-zero-acceptance.test.ts`：Adapter/Session Index 边界                                       | 通过                                                               |
| AS-8  | 00、03–06  | `workspace-access.test.ts`、`session-resources.test.ts`、`run-lifecycle.test.ts`、`streaming-cancel.test.ts`：Workspace/Session/Run/Cancel mutation 等价重试与 payload 冲突 | 通过                                                               |
| AS-9  | 00、06、08 | `streaming-cancel.test.ts`：统一版本化 SSE、Session/Run ID 路由、跨 Session 隔离；`run-state.test.ts`：UI 稳定 ID 路由                                                      | 通过                                                               |
| AS-10 | 08         | `phase-zero-acceptance.test.ts` 源码守卫：两个模型输出入口均固定 `html-policy="safe"`，禁止 `v-html`/`innerHTML`、危险 `javascript:` URL 与事件属性直通                     | 通过                                                               |

## Foundation / Security 证据

- `phase-zero-acceptance.test.ts` 读取实际 package manifest 与生产源码，稳定断言：Gateway 仅依赖 contracts；Web/生产包不依赖 testkit；contracts 不导入 Vue、DOM、Node 或 Pi；Web 不导入 Pi。
- 同一测试明确锁定 `PiRuntimeAdapter`、`RunRepository`、Session discovery、`PlatformPort`、Workspace Access、single Workspace 与 single active Run 策略调用边界。
- 集成 canary 使用 `BOOTSTRAP_CANARY`、运行时 credential、`FULL_PROMPT_CANARY`、完整 Transcript `durable answer` 和 `TOOL_PAYLOAD_CANARY`，捕获四类 console 输出并断言均未出现。
- 安全渲染采用源码断言而非复制第三方 renderer 测试：所有不可信 Transcript/streaming 内容只能进入 `MarkdownRender` 的 safe HTML policy；同时禁止直接 HTML sink、危险 URL 和事件属性绕行。
- contracts 与根 manifest 源码守卫断言 Phase 1+ 的 replay、epoch、revision、Steer、queue、SQLite 未成为 Phase 0 契约或依赖。

## 门禁实录

| 命令                | 期望                              | 实际结果                                            |
| ------------------- | --------------------------------- | --------------------------------------------------- |
| `pnpm test`         | 全部自动化验收通过                | 通过：Gateway 5 files/12 tests；Web 2 files/3 tests |
| `pnpm typecheck`    | 4 个 workspace package 无类型错误 | 通过：contracts、gateway、testkit、web              |
| `pnpm lint`         | ESLint 无错误                     | 通过                                                |
| `pnpm format:check` | Prettier 无差异                   | 通过：`All matched files use Prettier code style!`  |
| `git diff --check`  | 无空白错误                        | 通过                                                |

## Deferred 边界

未引入 SSE replay/epoch、durable mutation ledger、revision、SQLite、队列、Steer、多 Workspace、跨进程 Run 恢复或其他 Phase 1+ API；本票仅增加门禁、证据和根级统一 `test` 脚本。
