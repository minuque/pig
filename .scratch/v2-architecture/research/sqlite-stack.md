# SQLite 栈研究

## 结论

**推荐 `node:sqlite` + 应用内最小 SQL migration runner；不引入 ORM 或迁移库。**

理由排序是：npm 分发的安装可靠性、官方 Node 运行时可控性、FTS5/事务能力、以后作为 Node sidecar 打包的简单性。代价是必须把最低 Node 提到 **22.16.0**（该版本已取消 `--experimental-sqlite`，且官方 SQLite 编译配置和测试已启用 FTS5），并接受 `node:sqlite` 在 Node 22 仍是 Active development；Node 24.15.0 起文档标为 Release candidate。

若 Node 20 支持是硬约束，备选是 `better-sqlite3`；不要为了兼容 Node 20 同时维护两个生产 driver。

## 研究边界

候选：Node 内置 `node:sqlite`、`better-sqlite3`、无 ORM 的最小迁移方案。目标约束：npm 分发的 Node/Hono Gateway，Windows/macOS/Linux，应用自有 metadata、可重建 FTS5 投影、事务迁移，以及未来 Tauri/Electron 桌面 sidecar。事实来自官方文档或项目官方源码；“推荐/推论”单独标出。

## 事实：`node:sqlite`

- Node API 文档标明模块于 v22.5.0 加入；v23.4.0/v22.13.0 起不再需要 `--experimental-sqlite`，但在 Node 22 仍处于 experimental/Active development。当前文档的 history 又标明 v25.7.0/v24.15.0 起为 Release candidate。[Node SQLite API](https://nodejs.org/api/sqlite.html)
- `DatabaseSync`、`prepare()`、`exec()`、`close()` 和数据库连接选项均为内置同步 API；`exec()` 明确适合执行从文件读取的多条 SQL。API 没有 `better-sqlite3` 那种事务 callback；迁移需显式执行 `BEGIN`/`COMMIT`/`ROLLBACK`。[Node SQLite API](https://nodejs.org/api/sqlite.html)
- Node v22.16.0 的 SQLite 编译配置包含 `SQLITE_ENABLE_FTS5`，官方平行测试直接创建 `fts5` 虚拟表并查询 `MATCH`；这不是依赖宿主机 SQLite 动态库的能力。[Node v22.16 SQLite build](https://github.com/nodejs/node/blob/v22.16.0/deps/sqlite/unofficial.gni)；[Node v22.16 SQLite tests](https://github.com/nodejs/node/blob/v22.16.0/test/parallel/test-sqlite.js)
- SQLite 官方将 FTS5 定义为提供全文搜索的 virtual table module，并要求构建时启用 FTS5；这解释了为什么最低版本必须以实际编译配置和 smoke test 为准，而不能只看 `node:sqlite` 的首次版本。[SQLite FTS5](https://www.sqlite.org/fts5.html)
- `DatabaseSync` 运行在调用线程上；事实上的工程含义是迁移和大批量 FTS rebuild 会阻塞 Gateway。Node API 本身提供同步方法，没有替应用做 worker 调度。[Node SQLite API](https://nodejs.org/api/sqlite.html)
- `node:sqlite` 只通过 `node:` scheme 暴露，不产生 npm native addon、下载 prebuild 或 `node-gyp` 构建步骤。[Node SQLite API](https://nodejs.org/api/sqlite.html)

## 事实：`better-sqlite3`

- 当前官方 `v12.12.0` package 声明 Node engines 为 `20.x || 22.x || 23.x || 24.x || 25.x || 26.x`，安装脚本是 `prebuild-install || node-gyp rebuild --release`。因此它可以覆盖 Node 20，但并不是无 native 安装风险。[package.json](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/package.json)
- 官方 README 说 LTS Node 有 prebuilt binaries；没有匹配的 binary 时安装会回退到源码构建。官方 troubleshooting 要求 Windows 安装 Python、Visual Studio/C++ 工具等 native-module 工具，并说明 Electron 需要 `electron-rebuild`、asar 中的 native library 需要 unpack。[README](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/README.md)；[troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/docs/troubleshooting.md)
- 官方构建定义静态编译 SQLite，并启用 `SQLITE_ENABLE_FTS5`、FTS3/4、JSON1 等；因此 FTS5 不依赖用户机器上的 SQLite 安装。[SQLite compile definitions](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/deps/defines.gypi)
- API 提供 prepared statements、同步读写、WAL 建议，以及 `db.transaction(fn)`；事务成功自动 commit，异常自动 rollback，嵌套事务使用 savepoints。[README](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/README.md)；[API: transaction](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/docs/api.md)
- 官方包测试使用 Mocha；这证明包本身有测试体系，但不替代本项目在三 OS、Node 矩阵和实际 FTS schema 上的 contract tests。[package.json](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/package.json)

## 对比（事实与本项目推论）

| 维度 | `node:sqlite` | `better-sqlite3` |
|---|---|---|
| npm 安装 | **事实：** Node 自带，无 addon 下载/编译。 | **事实：** LTS 通常有 prebuild；否则 `node-gyp` 源码构建。Windows 工具链失败是现实安装分支。 |
| FTS5 | **事实：** 官方 Node v22.16.0 build/test 已启用。 | **事实：** 官方 SQLite compile definitions 启用。 |
| 事务 | **事实：** `exec()`/prepared statements，需显式 SQL 事务。 | **事实：** `transaction(fn)` 自动 commit/rollback，支持 savepoint。 |
| API 稳定性 | **事实：** Node 22 Active development；Node 24.15+ Release candidate。 | **事实：** 独立成熟包，但随 Node ABI 和 native prebuild 发布。 |
| Node 最低版本 | **事实：** 模块 v22.13.0 起免 flag；本项目 FTS5 基线取 v22.16.0。 | **事实：** 当前官方包声明支持 Node 20 及其列出的当前主版本。 |
| Windows/macOS/Linux | **推论：** 官方 Node binary 的行为最一致，安装失败面最小；仍需 CI 验证 FTS5。 | **推论：** LTS 目标组合可靠，但非 LTS、新 ABI、镜像源或缺工具链会进入源码构建。 |
| Tauri/Electron | **推论：** 把 Gateway 作为独立 Node sidecar 时只需随 sidecar 固定 Node >=22.16；若嵌入 Electron 主进程，则能力跟随 Electron 自带 Node 版本。 | **推论：** sidecar 要带匹配 ABI 的 addon；Electron 需要 rebuild/unpack，Tauri 也要把 native 资源纳入每个 target 的 sidecar 包。 |

## 推荐的 driver 边界

实现一个很薄的内部接口，例如 `SqliteConnection`（open/exec/prepare/transaction/close），业务层只依赖它，不把 Node 的 `DatabaseSync` 类型泄漏到 Hono routes。v2 只实现 `node:sqlite` adapter；接口的价值是隔离未来 Electron/Tauri 或 Node runtime 变化，不是现在同时支持两个 driver。

连接初始化建议：

1. 使用 `new DatabaseSync(path, { timeout: 5000 })`，启用/确认 foreign keys；
2. 对需要并发读的本地应用启用 WAL；WAL 不是迁移机制；
3. 启动阶段完成 migration，再接受请求；FTS rebuild 使用独立显式命令或受控启动任务，避免在请求线程中做大批量同步工作；
4. 启动时执行 `CREATE VIRTUAL TABLE ... USING fts5(...)` 的 smoke test/版本化测试，缺失时报出 Node 版本和升级提示，而不是静默退化到 LIKE。

## 迁移方案：自有 SQL runner

### 事实

- SQLite 的 `PRAGMA user_version` 是供应用使用的整数 schema version；SQLite 的事务由 `BEGIN`、`COMMIT`、`ROLLBACK` 控制。`BEGIN IMMEDIATE` 在开始时取得写事务，适合避免两个 Gateway 启动实例同时迁移。[SQLite PRAGMA](https://www.sqlite.org/pragma.html#pragma_user_version)；[SQLite transactions](https://www.sqlite.org/lang_transaction.html)
- `node:sqlite` 的 `exec(sql)` 支持执行从文件读取的多条语句，所以 migration 可以保持为可审查、可打包的 `.sql` 文件。[Node SQLite API](https://nodejs.org/api/sqlite.html)

### 推荐实现

- `migrations/0001_initial.sql`、`0002_fts.sql` 等按数字严格排序；已发布文件不可编辑，只能追加新版本。
- 读取 `PRAGMA user_version`；对每个下一个版本执行：`BEGIN IMMEDIATE` → `exec(file)` → `PRAGMA user_version = N` → `COMMIT`；任一异常执行 `ROLLBACK` 并让启动失败。
- 每个 migration 单独原子提交；不允许 migration 自己包含 transaction control、`VACUUM` 或依赖请求上下文。FTS projection 的初始表、触发器和 rebuild SQL 放进普通 migration；大型重建另做可重试的 projection rebuild。
- 只做 forward migrations，不承诺 down migration。测试中使用临时数据库和失败 SQL 验证“schema 和 user_version 都回滚”。
- 若未来需要审计、校验或非线性发布，再从 `user_version` 升级到 `schema_migrations(version, name, checksum, applied_at)`；v2 不提前支付该复杂度。

该 runner 的接口面小于引入 ORM，也能直接使用选定 driver 的事务语义；迁移文件是最终 SQL，避免 query builder 生成差异。

### 是否引入迁移库

**不引入 Umzug/Knex/ORM。** Umzug 的官方存储选项包括 JSON、memory、Sequelize、MongoDB；直接使用 SQLite 需要自定义 `UmzugStorage`，其官方 SQLite 示例实际通过 Sequelize + `SequelizeStorage`。这会增加依赖和 storage/context glue，而不会替代上述“执行 SQL + 原子更新版本”的核心代码。[Umzug README](https://github.com/sequelize/umzug/blob/main/README.md)；[Umzug storage contract](https://github.com/sequelize/umzug/blob/main/src/storage/contract.ts)

只有在需要库提供的回滚编排、事件、CLI、复杂 storage 或团队已有 Umzug 标准时，它才值得引入；当前单一本地 SQLite 文件没有满足条件。

## 测试与发布门槛

1. **Node API contract：** Node 22.16、当前 Node LTS；Windows/macOS/Linux；内存库验证 prepared statements、事务 rollback、WAL、foreign keys、FTS5 `MATCH`。
2. **migration contract：** 空库全量升级、旧库逐版本升级、重复启动幂等、故意失败后无半迁移、两个进程同时启动时锁/timeout 行为明确。
3. **projection contract：** FTS 表可由 metadata/原始 session projection 全量删除重建；重建后查询结果与增量写入一致；索引损坏不影响 Pi JSONL 事实源。
4. **distribution smoke：** 在 clean consumer 中 `npm pack`/安装 CLI，验证数据库路径解析和三 OS 的启动；因为选用 `node:sqlite`，不测试 native prebuild 下载。
5. **sidecar smoke（桌面阶段）：** Tauri 使用官方 `externalBin`/target-triple sidecar 机制；Electron 若将 Gateway 留在独立 Node sidecar，固定并测试随包 Node；若改为 Electron 主进程，单独测试 Electron 暴露的 Node 版本，不假设它等于系统 Node。[Tauri sidecar](https://v2.tauri.app/develop/sidecar/)；[Electron native Node modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)

## 决策与后果

### Decision

采用 **Node >=22.16.0 + `node:sqlite` + 自有编号 SQL migrations**。SQLite 只拥有应用 metadata 和可重建 FTS5 projection；Pi JSONL 仍按既有架构拥有会话事实。migration 在 Gateway 接受请求前运行，失败阻止启动；不引入 ORM/迁移库。

### Major trade-offs

- **收益：** npm 安装无 native addon、无平台编译工具链；官方 Node build 提供 FTS5；迁移和 FTS schema 完全可审查；未来 Node sidecar 只需固定 Node 版本。
- **代价：** 最低 Node 从“可用的 Node 版本”抬到 22.16.0；Node 22 API 仍 Active development；同步 API 需要把长迁移/重建移出请求路径；事务 helper 和迁移历史审计需要应用自己写。
- **备选触发：** 若产品必须支持 Node 20，或 Node API 稳定性在发布门槛中高于安装可靠性，则改用 `better-sqlite3`，最低 Node 20，接受 prebuild/node-gyp、Electron rebuild/unpack 和更复杂的 sidecar 资源打包。

## 来源索引

- [Node SQLite API](https://nodejs.org/api/sqlite.html)
- [Node v22.16 SQLite build flags](https://github.com/nodejs/node/blob/v22.16.0/deps/sqlite/unofficial.gni)
- [Node v22.16 SQLite tests](https://github.com/nodejs/node/blob/v22.16.0/test/parallel/test-sqlite.js)
- [better-sqlite3 v12.12.0 README](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/README.md)
- [better-sqlite3 v12.12.0 package.json](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/package.json)
- [better-sqlite3 transaction API](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/docs/api.md)
- [better-sqlite3 SQLite definitions](https://github.com/WiseLibs/better-sqlite3/blob/v12.12.0/deps/defines.gypi)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [SQLite PRAGMA user_version](https://www.sqlite.org/pragma.html#pragma_user_version)
- [SQLite transactions](https://www.sqlite.org/lang_transaction.html)
- [Umzug README](https://github.com/sequelize/umzug/blob/main/README.md)
- [Umzug storage contract](https://github.com/sequelize/umzug/blob/main/src/storage/contract.ts)
- [Tauri sidecar](https://v2.tauri.app/develop/sidecar/)
- [Electron native Node modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
