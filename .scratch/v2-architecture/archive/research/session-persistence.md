# AI coding agent 会话持久化的业界最佳实践

> 面向 `no-pi-no-gang-v2` 的架构决策调研  
> 调研日期：2025-02-14  
> 本机 Pi 基线：`@earendil-works/pi-coding-agent 0.80.10`

## 结论摘要

**推荐采用“Pi 原生 JSONL 为原始会话事实源 + 应用 SQLite 为元数据与可重建索引 + 运行时事件总线为进行中状态”的分层模型，不在 v2 引入完整事件存储。**

- **[事实]** Pi 的恢复、分支、压缩、模型切换、标签、扩展状态都建立在其版本化 JSONL 树上；`SessionManager` 明确把会话描述为 append-only tree，`AgentSession` 在 `message_end` 后负责持久化最终消息。[Pi 会话格式](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/session-format.md)；[SessionManager 源码](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)；[AgentSession 源码](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/agent-session.ts)
- **[事实]** Codex 已采用相同的混合边界：rollout JSONL 保存可恢复历史，SQLite 保存 thread 元数据并由 rollout 回填、校验和修复；SQLite 不可用时仍回退到 rollout 文件。[Codex recorder](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/recorder.rs)；[Codex state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)；[threads schema](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/state/migrations/0001_threads.sql)
- **[推论]** 在 Pi 已经拥有完整、可恢复的领域日志时，再让应用 SQLite 或第二套事件存储成为同一会话的事实源，会制造双写、顺序、迁移和语义映射问题；除非产品明确需要多写者离线合并、强审计重放或跨服务投影，否则收益不足以覆盖复杂度。该推论以 Pi 的原生格式边界、Codex 的混合实现以及 OpenCode 完整事件存储所需的序列、事务、replay 和 projector 机制为依据。[Pi SessionManager](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)；[OpenCode EventV2](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event.ts)；[OpenCode projector](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/session/projector.ts)

---

## 1. 研究口径

本文中的“事实源”指：**在崩溃恢复、继续会话、分支和导出出现冲突时，最终决定会话语义的权威记录**。缓存、列表元数据、全文索引和 UI 运行状态不因可持久化就自动成为事实源。

来源仅采用：

1. Pi 官方 SDK、源码和会话格式；
2. OpenAI Codex、Anthropic Claude Agent SDK 的官方源码或文档；
3. OpenCode、OpenHands、Hermes Agent 等开源 coding-agent 的官方仓库架构或源码。

本文以 **[事实]** 标识来源直接陈述或源码直接实现的行为，以 **[推论]** 标识针对本项目约束得出的架构判断。

---

## 2. 一手来源观察

### 2.1 Pi：原生会话本身已是领域日志

- **[事实]** Pi 会话位于 `~/.pi/agent/sessions/.../*.jsonl`；首行是带版本、会话 ID、cwd 的 header，后续 entry 通过稳定 `id`/`parentId` 组成树，可在同一文件内保留分支。[Pi 会话格式](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/session-format.md)
- **[事实]** 持久条目不仅是聊天消息，还包括模型与 thinking level 变化、compaction、branch summary、label、session info、扩展 `custom` 和 `custom_message`。`custom` 可保存扩展状态但不进入 LLM context，`custom_message` 会进入 context。[Pi 会话格式](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/session-format.md)
- **[事实]** `SessionManager` 的正常写入是追加；分支只移动内存中的 leaf，下一条记录以旧 entry 为 parent，不修改旧历史。旧格式迁移和显式抽取分支时会重写/新建文件，因此“append-only”是正常会话演进的逻辑约束，不是“文件永不重写”的绝对物理约束。[SessionManager 源码](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)
- **[事实]** SDK 的 `AgentSession` 管理 message history、model state、compaction 和事件流；官方源码注释明确说明会话持久化由内部在 `message_end` 时完成。会话替换由 `AgentSessionRuntime` 管理，替换后订阅必须重新绑定。[Pi SDK 文档](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/sdk.md)；[AgentSession 源码](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/agent-session.ts)
- **[事实]** RPC 把 `message_update`、tool progress、queue、retry 等作为实时事件输出；同时提供 `get_entries(since)`，把稳定 entry ID 明确定义为跨客户端重启可用的 durable cursor，并返回当前 leaf。[Pi RPC 文档](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/rpc.md)

**[推论]** Pi JSONL 不是普通“聊天导出文件”，而是 Pi 的持久领域模型。若应用绕过它，以自己的 message 表重建会话，必须重新实现树、压缩、分支摘要、扩展条目、模型状态和未来格式迁移，语义漂移风险高。[Pi 会话格式](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/session-format.md)

### 2.2 Codex：原始 JSONL + SQLite 投影的直接先例

- **[事实]** Codex 的 `RolloutRecorder` 将会话写入 `sessions/YYYY/MM/DD/rollout-...jsonl`，首条是 `SessionMeta`，后续 canonical items 由单独 writer task 排序追加；`flush()` 是明确的持久化边界，恢复时从 rollout 读取全部 items。[Codex recorder](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/recorder.rs)
- **[事实]** Codex SQLite `threads` 表保存 rollout path、时间、source、provider、cwd、title、tokens、archive 和 git 信息，但不把完整 thread body 塞进该表。[threads schema](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/state/migrations/0001_threads.sql)
- **[事实]** Codex 启动时从 rollout 元数据 backfill SQLite；列表优先走 SQLite，检查 rollout 路径是否仍存在，删除 stale row；DB 失败时回退文件扫描；也可从 rollout 重新 reconcile SQLite。[Codex state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)；[Codex recorder 的 DB fallback](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/recorder.rs)

**[推论]** Codex 的边界说明：原始会话文件负责恢复正确性，数据库负责发现、过滤、排序和元数据性能；投影可以修复或重建，原始记录不依赖投影才能解释。这与 Pi 底座最匹配。[Codex state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)

### 2.3 Claude：跨主机扩展优先“镜像原生 transcript”

- **[事实]** Claude Agent SDK 默认把会话保存在 `$CLAUDE_CONFIG_DIR/projects/<encoded-cwd>/<session-id>.jsonl`，按 session ID resume；跨主机恢复通过 `SessionStore` 将 transcript 镜像到外部后端。[Claude Sessions 文档](https://platform.claude.com/docs/en/agent-sdk/sessions)；[TypeScript SDK reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- **[事实]** Anthropic 官方 cookbook 明确称 `SessionStore` 是 mirror：本地磁盘先写，mirror 失败产生 `mirror_error` 而不中断 agent。[Hosting your agent](https://platform.claude.com/cookbook/claude-agent-sdk-07-hosting-the-agent)
- **[事实]** 官方参考 adapter 展示了 S3 分片 JSONL、Redis append list、Postgres 一条 transcript entry 一行三种实现；契约核心是 `append`、按原顺序 `load`、项目/会话隔离和可选删除/子路径。官方同时强调这些是 reference implementation，生产环境要自行处理保留策略、失败监控和并发顺序。[SessionStore adapters README](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/README.md)；[conformance suite](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/shared/conformance.ts)

**[推论]** 未来远程化不要求今天把应用数据库升级为会话事实源。更低风险的路径是：worker 继续按运行时原生格式单写，后台镜像完整有序 transcript；其他主机恢复前先物化同一原生格式。[Claude Sessions 文档](https://platform.claude.com/docs/en/agent-sdk/sessions)；[S3 adapter](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/s3/src/S3SessionStore.ts)

### 2.4 SQLite 与完整事件存储的开源实践

- **[事实]** Hermes Agent 选择 SQLite 作为会话 metadata、完整 messages、model config 的 canonical store，并用 WAL、FTS5、schema version、写入重试和 session lineage；其文档明确说明这是替代旧 JSONL 的整体模型。[Hermes Session Storage](https://github.com/NousResearch/hermes-agent/blob/9ef66ea8c12593678de52cb16c50df713e07669f/website/docs/developer-guide/session-storage.md)
- **[事实]** OpenCode 的完整事件存储实现为每个 aggregate 分配连续 `seq`，在 SQLite 中持久化 event/event_sequence，支持 read-after、replay、owner claim、重复事件一致性校验，并在同一事务内运行 projectors；session/message 等表由 projector 更新。[OpenCode EventV2](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event.ts)；[event schema](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event/sql.ts)；[session projector](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/session/projector.ts)
- **[事实]** OpenHands 将事件 CRUD、检索、分页和实时流抽象为 `EventService`，可使用文件系统、S3 或 GCS 后端，显示了事件模型在远程部署中需要独立的存储接口和后端实现。[OpenHands event README](https://github.com/All-Hands-AI/OpenHands/blob/11d4ecf21fc144d10a614ddba63b84de5c90bfd4/openhands/app_server/event/README.md)；[EventServiceBase](https://github.com/All-Hands-AI/OpenHands/blob/11d4ecf21fc144d10a614ddba63b84de5c90bfd4/openhands/app_server/event/event_service_base.py)

**[推论]** SQLite 事实源和完整事件存储都可行，但前提是应用本身拥有 agent 的持久语义。Pi 已经拥有这层语义；在其上叠加第二事实源，与 Hermes 从 JSONL 整体迁走、OpenCode从事件到投影的单一闭环不同，会形成两个权威模型。[Hermes Session Storage](https://github.com/NousResearch/hermes-agent/blob/9ef66ea8c12593678de52cb16c50df713e07669f/website/docs/developer-guide/session-storage.md)；[OpenCode EventV2](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event.ts)

---

## 3. 三种模型比较

| 模型 | 权威记录 | 优点 | 主要代价/风险 | 对本项目适配度 |
|---|---|---|---|---|
| **A. 运行时原生 JSONL 为事实源** | Pi JSONL；SQLite 仅为投影 | 100% 保留 Pi tree/compaction/custom 语义；Pi 可直接 resume；可读、可复制、可导出；升级路径由 Pi 格式版本负责 | 大量会话的列表/全文搜索不能反复扫文件；多进程同时写同一文件没有现成协调语义；需要投影一致性机制 | **最高，推荐** |
| **B. 应用 SQLite 为事实源** | 应用 sessions/messages/parts 表；Pi 只是执行器 | 列表、事务、关系、FTS、分页统一；桌面 UI 查询简单；单机备份集中 | 必须把 SQLite 状态无损转换成 Pi tree，并处理 Pi 格式升级；Pi 写 JSONL 与应用写 DB 会双写，或必须禁用 Pi 持久化并重写其 SessionManager 语义；数据库损坏影响恢复与搜索两条路径 | **低，不建议作为 v2 基线** |
| **C. 完整事件存储** | 应用定义的 versioned events；会话视图与索引均为 projector | 审计、重放、时间旅行、多投影、远程订阅、幂等复制边界清晰 | 必须设计 aggregate、连续序列、事件版本、幂等、owner、projector、snapshot、重放失败策略；还要决定如何与 Pi JSONL 对齐，复杂度最大 | **当前过度设计；满足明确触发条件后再上** |

### 3.1 模型 A：原生 JSONL 为事实源

- **[事实]** Pi 和 Codex 都可直接从各自 JSONL 恢复；Codex 已证明可以在其上增加 SQLite 元数据层而保留文件 fallback。[Pi SessionManager](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)；[Codex state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)
- **[推论]** 搜索慢不是更换事实源的充分理由；应通过增量投影解决。Pi RPC 的 durable entry cursor 允许应用只索引新增 entry，而不是每次全量扫描。[Pi RPC `get_entries`](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/rpc.md)
- **[推论]** 每个 active session 应只有一个 Pi writer。桌面窗口、Web 客户端和远程控制端都向该 writer 发命令，不直接改 JSONL；其他组件只读或消费镜像。此约束来自 `SessionManager` 单 leaf/顺序追加模型以及 Claude S3 adapter 对多 writer 时钟顺序风险的明确提示。[Pi SessionManager](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)；[Claude SessionStore README](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/README.md)

### 3.2 模型 B：应用 SQLite 为事实源

- **[事实]** Hermes 展示了 SQLite canonical store 的完整配套：message schema、FTS trigger、WAL、迁移、锁竞争重试和导出/清理。它不是“加一张 messages 表”这么简单。[Hermes Session Storage](https://github.com/NousResearch/hermes-agent/blob/9ef66ea8c12593678de52cb16c50df713e07669f/website/docs/developer-guide/session-storage.md)
- **[推论]** 若本项目选此模型，必须二选一：① 禁用 Pi 持久化并由应用实现等价的 Pi session adapter；② 保留 Pi JSONL 并做数据库双写。前者接管 Pi 内部语义，后者无法天然保证跨两个介质的原子提交，均比模型 A 风险高。[Pi SDK session management](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/sdk.md)；[Pi SessionManager](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)
- **[推论]** 只有当产品决定“Pi 可替换，应用会话协议才是长期公共协议”，并愿意为所有 runtime 编写无损 adapter 时，SQLite 事实源才合理。当前“Pi 作为底座”与此前提相反。

### 3.3 模型 C：完整事件存储

- **[事实]** OpenCode 为可靠事件存储实现了 aggregate sequence、事务提交、owner claim、重复 replay 校验、durable stream 和 projector；这些是完整事件存储的实际基础设施，而非简单保存 UI 事件。[OpenCode EventV2](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event.ts)；[event schema](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event/sql.ts)
- **[推论]** 不应直接把 Pi 的每个 `text_delta` 或 `tool_execution_update` 当永久领域事件：它们是高频、可丢失后重建 UI 的传输事件；真正可恢复边界是 Pi 已持久化的 session entry。否则事件量膨胀且产生“event store 与 Pi JSONL 哪个算完成消息”的冲突。[Pi RPC 事件与 `get_entries`](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/rpc.md)
- **[推论]** 只有出现以下至少一项硬需求时再评估完整事件存储：多设备离线并发写同一会话；法规级不可变审计；从任意中间 tool/approval 状态精确重放；多个独立服务需要可靠消费同一 ordered log；原生 runtime 不再拥有会话协议。

---

## 4. 推荐的数据所有权

### 4.1 所有权矩阵

| 数据 | 格式/写入所有者 | 持久位置 | 是否事实源 | 恢复/重建规则 |
|---|---|---|---|---|
| **原始会话**：messages、tool results、tree、compaction、branch summary、Pi-native labels/name/model state/custom entries | **Pi `SessionManager` / 单 active runtime** | Pi 原生 JSONL；远程阶段可增加原样镜像 | **是** | 以 Pi `SessionManager.open()` / runtime switch 为准；应用 DB 不反向拼装会话 |
| **应用元数据**：favorite、应用标签、workspace/window、归档策略、remote mirror 状态、last-opened、产品权限 | **no-pi-no-gang 应用层** | 应用 SQLite；远程控制面可使用服务端关系库 | **仅对应用语义是** | 以 `pi_session_id` 为外键；缺失不影响 Pi resume；Pi-native name/label 只做投影，不另设冲突权威值 |
| **搜索索引**：entry 文本、tool 名、摘要、项目/cwd、branch/role、FTS token | **应用 indexer/projector** | SQLite FTS5（或未来专用搜索后端） | **否，派生数据** | 根据 JSONL 全量重建；平时按 durable entry cursor 增量更新；删除/重建不影响原会话 |
| **运行中事件**：text delta、thinking delta、tool progress、queue/retry、临时状态 | **run coordinator / Pi adapter** | 内存 event bus + WebSocket/SSE；可选短期 ring buffer | **否** | 断线后先用 run snapshot 恢复 UI，再用 Pi `get_entries(since)` 对齐 durable 边界；未完成 run 标记 interrupted/unknown |
| **粗粒度运行记录**：run_id、session_id、host、started/ended、status、last durable entry、错误摘要、待审批引用 | **应用 run coordinator** | 应用 SQLite | 对调度状态是事实源，不是会话内容事实源 | 进程重启时清理过期 lease，将 running 转 interrupted；随后从 Pi entry cursor reconcile |

### 4.2 原始会话为什么归 Pi

- **[事实]** Pi 自己定义并迁移 session version，自己根据 tree 与 compaction 构造 LLM context，也允许扩展持久化 custom entry。[Pi 会话格式](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/session-format.md)
- **[推论]** 因而 Pi 必须拥有原始会话的 schema 和顺序写权限；应用只拥有文件生命周期编排（选择、删除、镜像、备份），不拥有其内部语义。应用若需要展示 name/labels，应从 Pi 条目投影，而不是维护可冲突的第二份权威字段。

### 4.3 应用元数据为什么归 SQLite

- **[事实]** Codex 将 title、archive、cwd、git、source、provider、token 等可查询信息放进 SQLite，并能从 rollout 重新 reconcile。[Codex threads schema](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/state/migrations/0001_threads.sql)；[Codex reconcile](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)
- **[推论]** 产品 UI 与远程调度产生的字段不应塞进 Pi `custom` entry，除非它们必须随会话导出并影响 Pi 扩展恢复。否则每次 favorite/window 状态变化都会污染会话树，并把应用 schema 绑到 Pi session migration。

建议最小表边界：

```text
sessions_projection(
  pi_session_id PK, session_path, cwd, created_at, last_activity_at,
  display_title_projection, first_prompt_projection, model_projection,
  last_entry_id, source_fingerprint, index_version
)

session_app_metadata(
  pi_session_id PK/FK, favorite, app_tags_json, archived_at,
  remote_object_key, mirror_state, last_opened_at
)

session_search(
  pi_session_id, entry_id, parent_id, role, entry_type,
  branch_hint, text, timestamp, content_hash,
  PK(pi_session_id, entry_id)
)

runs(
  run_id PK, pi_session_id, host_id, status, started_at, ended_at,
  last_durable_entry_id, lease_until, error_summary
)
```

**[推论]** `sessions_projection` 和 `session_search` 必须可整表丢弃重建；`session_app_metadata` 与 `runs` 才是应用自有事实。可重建性应通过实际 rebuild 命令和 schema `index_version` 保证，而不是只写在文档里。Codex 的 backfill/reconcile/fallback 是可参考的实现模式。[Codex state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)

### 4.4 搜索索引为什么不能成为会话事实源

- **[事实]** Hermes 的 FTS5 由 message 表 INSERT/UPDATE/DELETE trigger 同步，并提供重建/迁移；Codex 在 SQLite 路径异常时回退原始 rollout。[Hermes FTS 架构](https://github.com/NousResearch/hermes-agent/blob/9ef66ea8c12593678de52cb16c50df713e07669f/website/docs/developer-guide/session-storage.md)；[Codex DB fallback](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/recorder.rs)
- **[推论]** 本项目应索引所有 durable Pi entry（包括 abandoned branches），但恢复 context 仍调用 Pi；搜索结果返回 `(pi_session_id, entry_id)`，由 Pi tree API 决定该 entry 所属路径和可恢复位置。不要在搜索层复制一套 compaction/branch 解释器。[Pi tree/context 规则](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/session-format.md)

### 4.5 运行中事件为什么归 run coordinator

- **[事实]** Pi 将 streaming delta、tool update、retry、queue 作为实时事件，而 completed messages 进入 session persistence；RPC 允许用 durable entry cursor 在重连后获取缺失持久条目。[Pi AgentSession](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/agent-session.ts)；[Pi RPC](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/rpc.md)
- **[推论]** coordinator 应给传输事件增加自己的单调 `run_seq`，用于同一 live connection 的排序和短期重连；但 `run_seq` 不取代 Pi entry ID。永久保存每个 token delta 没有恢复收益，默认只保存粗粒度 lifecycle、审批和错误摘要。

---

## 5. 本地优先、桌面与远程扩展路径

### 阶段 1：本地优先 v2

1. **[推论]** 每个 session 由一个嵌入式 Pi SDK runtime 或 Pi RPC sidecar 单写 JSONL；UI 不直接访问会话文件。
2. **[事实]** Pi 官方建议 Node/TypeScript 同进程集成优先使用 SDK；需要进程隔离或非 Node 客户端时使用 RPC。[Pi SDK/RPC 选择](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/sdk.md)
3. **[推论]** SQLite indexer 订阅 session completion，并用 `get_entries(since=last_entry_id)` 增量投影；启动时比较文件 fingerprint/last entry，发现不一致则重建该 session 索引。[Pi RPC durable cursor](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/rpc.md)
4. **[推论]** 文件 watcher 只用于发现外部新增/删除/重写，不能作为写入提交信号；最终以能被 Pi 成功解析的 entry 为准。

### 阶段 2：桌面多窗口

- **[事实]** OpenCode 的桌面/TUI采用本地 server + client API，server 暴露 session、message、status 和 event 接口，说明多客户端不必变成多写者。[OpenCode server 文档](https://opencode.ai/docs/server)
- **[推论]** 所有窗口连接同一 local daemon/run coordinator；daemon 持有 Pi runtime、文件 writer、SQLite connection 和事件 fan-out。窗口仅持有 view state 与 cursor。
- **[推论]** 并发 prompt 由 coordinator 串行化或映射到 Pi steer/follow-up queue，不允许两个 runtime 打开同一 JSONL 追加。

### 阶段 3：远程 worker / 跨主机恢复

- **[事实]** Claude SDK 的跨主机方案是把 transcript mirror 到外部 `SessionStore`，恢复时在新主机加载；S3、Redis、Postgres 都可承载同一 append/load 契约。[Claude Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)；[SessionStore adapters](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/README.md)
- **[推论]** Pi 远程方案应复制这一边界：
  1. worker 获取 session lease；
  2. 把远端对象物化成完整 Pi JSONL；
  3. 由一个 Pi runtime 打开并追加；
  4. 在 durable boundary 后镜像新增 bytes/完整文件和校验值；
  5. 释放 lease 后其他主机才可继续写。
- **[推论]** 远端对象存储保存原始 JSONL，服务端关系库保存应用 metadata/lease，搜索服务保存派生索引。三者有明确主从关系，不能用“最后写入者获胜”合并同一会话文件。
- **[推论]** 若未来必须支持多设备离线同时编辑同一会话，应先把需求定义为 fork/branch 合并，而非共享 leaf；若必须自动合并，再启动完整事件存储/CRDT 的独立 ADR。

---

## 6. 一致性、失败与迁移规则

1. **先原始会话，后投影。**  
   **[推论]** 只有 Pi durable entry 成功出现后，才更新 SQLite projection；投影失败进入 retry queue，不回滚 Pi 会话。Codex 的 DB 不可用回退与 reconcile 支持这一优先级。[Codex state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)

2. **投影幂等。**  
   **[推论]** 使用 `(pi_session_id, entry_id)` 唯一键和 content hash；重复消费无副作用。若检测到相同 entry ID 不同 hash，标记 session dirty 并全量重建，不静默覆盖。

3. **显式 durability boundary。**  
   **[事实]** Pi 在最终 `message_end` 处理持久化；Codex 和应用设置管理器都提供显式 flush 概念。不要把收到 token delta 等同于已持久化。[Pi AgentSession](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/agent-session.ts)；[Codex recorder flush](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/recorder.rs)

4. **原生格式迁移由 Pi 执行。**  
   **[事实]** Pi 加载旧 session 时迁移到当前版本并可能重写文件。[Pi SessionManager migration](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)  
   **[推论]** 应用检测文件 fingerprint 变化后使旧 projection 失效并重建，不能自行迁移 Pi entry。

5. **删除与保留策略覆盖所有副本。**  
   **[事实]** Anthropic 参考 adapter 明确把外部 store retention 和删除责任交给应用，本地 transcript 又有独立清理策略。[Claude SessionStore production checklist](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/README.md)  
   **[推论]** 删除会话必须编排 JSONL、SQLite app metadata、搜索索引、远程镜像和临时事件缓存；索引中的全文是内容副本，不可遗漏。

6. **损坏隔离。**  
   **[推论]** 打不开或 header 无效的 JSONL 移入 quarantine 并保留原字节；不得用可能过期的 SQLite projection 自动覆盖原文件。SQLite 可从健康 JSONL 重建。

---

## 7. 建议写入 ADR 的决策

### Decision

采用 **Native Session + Application Projection**：

- Pi JSONL 是原始会话唯一事实源；
- 应用 SQLite 拥有应用元数据、run 调度状态，并承载可重建的会话/搜索投影；
- live Pi events 由 run coordinator 管理，默认不永久事件溯源；
- 远程扩展通过原生 JSONL 镜像、single-writer lease 和 materialize-before-resume 实现；
- 暂不建设完整事件存储。

### Consequences

- **[推论] 正面：** 最大限度复用 Pi 的 resume/tree/compaction/migration；本地数据可读可搬迁；桌面查询性能由 SQLite 保证；未来可增加远程镜像而不翻转事实源。
- **[推论] 负面：** 需要实现可靠 indexer/reconcile；会话内容和应用元数据不在同一事务；远程阶段必须有 lease 与镜像完整性校验。
- **[推论] 可接受性：** 这些代价小于维护第二套 Pi 会话语义或完整事件平台，且 Codex、Claude 的官方实现提供了直接先例。[Codex state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)；[Claude Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)

### Revisit triggers

出现以下任一条件时重开 ADR：

1. 应用需同时支持多个可替换 runtime，且定义统一会话协议；
2. 同一会话必须允许跨设备/跨主机并发离线写入并自动合并；
3. 合规要求对每个 tool/approval transition 做不可变审计和确定性重放；
4. 超过一个独立服务必须可靠消费同一 ordered session log；
5. Pi 原生格式无法表达产品必需的持久语义，且扩展 `custom` entry 仍不足。

在触发前，**不要把“未来可能远程”当作现在建设完整事件存储的理由**；Claude 的 transcript mirror 与 Codex 的 JSONL + SQLite 已表明存在更渐进的扩展路径。[Claude SessionStore](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/README.md)；[Codex recorder/state DB](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)

---

## 8. 来源索引

### Pi

- [Session file format](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/session-format.md)
- [SessionManager source](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/session-manager.ts)
- [AgentSession source](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/agent-session.ts)
- [SDK documentation](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/sdk.md)
- [RPC documentation](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/rpc.md)

### OpenAI Codex

- [Rollout recorder](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/recorder.rs)
- [SQLite state DB bridge](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/rollout/src/state_db.rs)
- [Threads schema](https://github.com/openai/codex/blob/0fb559f0f6e231a88ac02ea002d3ecd248e2b515/codex-rs/state/migrations/0001_threads.sql)

### Anthropic Claude Agent SDK

- [Work with sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [TypeScript SDK reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Hosting your agent](https://platform.claude.com/cookbook/claude-agent-sdk-07-hosting-the-agent)
- [SessionStore reference adapters](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/README.md)
- [SessionStore conformance](https://github.com/anthropics/claude-agent-sdk-typescript/blob/cf5a4421352f7411025e3937d97f4f731dc3249b/examples/session-stores/shared/conformance.ts)

### 成熟开源 coding-agent

- [Hermes Agent session storage](https://github.com/NousResearch/hermes-agent/blob/9ef66ea8c12593678de52cb16c50df713e07669f/website/docs/developer-guide/session-storage.md)
- [OpenCode durable event store](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event.ts)
- [OpenCode event schema](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/event/sql.ts)
- [OpenCode session projector](https://github.com/anomalyco/opencode/blob/b8142c7aa8f88222873fb79d636e312e28037c2d/packages/core/src/session/projector.ts)
- [OpenCode local server architecture](https://opencode.ai/docs/server)
- [OpenHands event architecture](https://github.com/All-Hands-AI/OpenHands/blob/11d4ecf21fc144d10a614ddba63b84de5c90bfd4/openhands/app_server/event/README.md)
- [OpenHands EventServiceBase](https://github.com/All-Hands-AI/OpenHands/blob/11d4ecf21fc144d10a614ddba63b84de5c90bfd4/openhands/app_server/event/event_service_base.py)
