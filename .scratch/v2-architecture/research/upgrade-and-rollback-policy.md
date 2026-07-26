# 升级与回滚策略外部事实调研

> 范围：只使用 Node.js、SQLite、npm CLI、Pi 官方文档或官方源码。`事实`是来源明确写出的行为；`架构建议`是基于这些事实的工程取舍，不是上游承诺。

## 结论摘要

- Node 22.19.0 的 `node:sqlite` 已包含 `sqlite.backup()`（v22.16.0 加入），但模块整体仍标为 Stability 1.1（Active development）。它是 SQLite Online Backup API 的封装，适合对运行中的 WAL 数据库做一致快照；不要把 Node/npm 版本回退误当作数据回滚。
- SQLite 文件格式对旧版本总体向后兼容，但“旧 SQLite 引擎能否打开”不等于“旧应用能否理解新表、列、约束或数据语义”。WAL 本身就是旧版本的前向兼容边界之一。
- npm 可以精确重建某个包及其依赖树（显式版本、lockfile、`npm ci`），`engines` 默认只是警告；这些机制不回滚已经执行的数据库迁移、数据写入或安装脚本副作用。
- Pi 的 JSONL Session 有显式版本并提供旧版本向当前版本的自动迁移；官方文档/源码没有 schema downgrade 或旧二进制读取未来 Session schema 的承诺。当前源码对 `version >= CURRENT_SESSION_VERSION` 不迁移，也不拒绝未来版本。

## 1. Node 22.19+ `node:sqlite` 与本地 WAL 数据库

### 事实

1. `node:sqlite` 模块在 Node v22.5.0 加入，文档将其标为 **Stability 1.1 - Active development**。`DatabaseSync` 的 API 是同步执行的。[Node v22.19.0 SQLite 文档](https://nodejs.org/download/release/v22.19.0/docs/api/sqlite.html#sqlite)
2. `sqlite.backup(sourceDb, destination[, options])` 在 v22.16.0 加入：源 `DatabaseSync` 必须已打开；目标是路径，已存在文件会被覆盖；可指定 `source`、`target`、每批页数 `rate` 和进度回调；返回在完成时 resolve、出错时 reject 的 Promise。[Node backup API](https://nodejs.org/download/release/v22.19.0/docs/api/sqlite.html#sqlitebackupsourcedb-destination-options)
3. Node 的 backup 封装了 `sqlite3_backup_init()`、`sqlite3_backup_step()`、`sqlite3_backup_finish()`。备份期间目标可正常使用；同一个 `DatabaseSync` 连接产生的变更会及时反映，其他连接的变更会使备份过程重启。[Node backup API](https://nodejs.org/download/release/v22.19.0/docs/api/sqlite.html#sqlitebackupsourcedb-destination-options)
4. `database.close()` 在 v22.5.0 加入，包装 `sqlite3_close_v2()`；数据库已关闭时再次调用会抛异常。[Node close API](https://nodejs.org/download/release/v22.19.0/docs/api/sqlite.html#databaseclose)
5. Node 没有单独的 JavaScript `checkpoint()` 方法；可通过 `database.exec()` 执行 SQLite 的 `PRAGMA wal_checkpoint(...)`。这是 SQLite 的 SQL 能力，不应表述成 Node 专有备份 API。[Node exec API](https://nodejs.org/download/release/v22.19.0/docs/api/sqlite.html#databaseexecsql)、[SQLite WAL checkpoint](https://sqlite.org/wal.html#ckpt)
6. SQLite WAL 中，原数据库文件保留旧页面，提交记录追加到 `database-wal`；checkpoint 才把 WAL 内容复制回主数据库。默认在 WAL 达到约 1000 页时自动 checkpoint；最后一个数据库连接关闭时通常会做最后一次 checkpoint，并删除 WAL 及其 shared-memory 文件。[SQLite WAL](https://sqlite.org/wal.html#how)
7. 只要还有读事务阻塞，checkpoint 可能无法完成；SQLite 说明 WAL 文件是数据库的持久状态，复制或移动数据库时应与数据库一起保留。把主文件与 WAL 分离，可能丢失已提交事务或造成损坏。[SQLite WAL](https://sqlite.org/wal.html#how)、[SQLite WAL 文件](https://sqlite.org/wal.html#the_wal_file)

### 对 `app.sqlite3` 的含义

- **事实边界**：`sqlite.backup()` 读取 SQLite 一致快照，不要求手工先复制 `app.sqlite3-wal`；它比外部文件复制适合在线备份。
- **事实边界**：关闭一个 Node 连接不代表整个数据库已无 WAL 活动；只有最后一个连接关闭才有 SQLite 的“最后 checkpoint/清理”行为，其他进程或连接仍可能持有读事务。
- **架构建议**：在线服务优先使用 `sqlite.backup()` 到新的临时/版本化目标；不要在 WAL 活跃时用 `copy app.sqlite3` 作为备份。若必须做物理文件复制，应先停止所有读写者、结束事务，并确认按 SQLite 的命名关系处理 WAL/SHM；更简单的运维规则是只复制已静止且无 WAL 的主文件。

## 2. SQLite 官方备份、VACUUM INTO、文件复制和元数据

### 官方备份 API

- 传统“加共享锁后用 `cp`/`copy` 复制主文件”只适用于复制期间没有事务；官方指出它不能用于内存数据库，且复制过程中发生电源/系统故障时备份可能损坏。[SQLite Backup API：Other Backup Techniques](https://sqlite.org/backup.html#other_backup_techniques)
- Online Backup API 可以增量复制运行中的数据库；源只在实际读取的短时间内被锁定，完成后目标是复制开始时源数据库的 bit-wise snapshot。[SQLite Online Backup API](https://sqlite.org/backup.html#using_the_sqlite_online_backup_api)
- SQLite 的损坏指南明确警告：事务进行中直接做文件备份可能混合新旧内容；安全方法包括 Backup API、`VACUUM INTO` 等。安全复制主文件的前提是复制期间没有事务。[SQLite How To Corrupt](https://sqlite.org/howtocorrupt.html#backup_or_restore_while_a_transaction_is_active)

### `VACUUM INTO`

- `VACUUM INTO 'file'` 是 live backup 的另一种方式，输出是原数据库的一致快照；目标文件必须不存在或为空，否则失败。[SQLite VACUUM INTO](https://sqlite.org/lang_vacuum.html#vacuum_into)
- 它会生成更紧凑的数据库并清除已删除内容；相比之下 Backup API CPU 更少且可增量执行。[SQLite VACUUM INTO](https://sqlite.org/lang_vacuum.html#vacuum_into)
- `VACUUM INTO` 完成前遭遇非计划关机/断电，输出可能不完整或损坏；原库 `PRAGMA synchronous=NORMAL` 或 `FULL` 时，完成后 SQLite 会同步输出文件（仍以 OS、文件系统和硬件正常为前提）。[SQLite VACUUM INTO](https://sqlite.org/lang_vacuum.html#vacuum_into)

### `user_version` 与 `application_id`

- `PRAGMA user_version` 读写数据库头 offset 60 的整数；SQLite 自身不使用它，应用可以自行定义含义。[SQLite `user_version`](https://sqlite.org/pragma.html#pragma_user_version)
- `PRAGMA application_id` 读写数据库头 offset 68 的 32-bit signed big-endian Application ID；SQLite 建议把使用 SQLite 作为应用文件格式的应用设置为唯一值，让 `file(1)` 等工具识别文件类型。[SQLite `application_id`](https://sqlite.org/pragma.html#pragma_application_id)
- **架构建议**：固定 `application_id` 作为“这是本应用的数据库”校验值，用 `user_version` 表示应用 schema 版本；迁移前后均读取并记录二者。它们是标记/门禁，不会自动迁移、验证业务 schema，也不会提供 downgrade。

### SQLite 引擎的兼容性边界

- SQLite 3.0.0 之后底层文件格式完全向后兼容：新 SQLite 总能读写旧 SQLite 创建的文件。旧 SQLite 有时能读写新 SQLite 文件，但存在前向兼容断点；WAL 是 SQLite 3.7.0 引入的例子，3.7.0 之前的 SQLite 无法读写使用 WAL 的文件。[SQLite File Format Changes](https://sqlite.org/formatchng.html)
- 官方总结是：旧版本只能在没有使用它不认识的新特性的情况下读写新版本创建的文件。[SQLite File Format Changes](https://sqlite.org/formatchng.html)
- **架构建议**：不能用“SQLite 文件格式向后兼容”替代应用 schema 兼容策略。新增表/列、约束、索引、触发器、编码后的业务语义仍由应用负责；旧二进制必须按应用声明的最大 `user_version` 做启动门禁。

## 3. npm CLI、安装/更新/降级与 `engines`

### 事实

1. `npm install` 会安装包及依赖；无参数安装时优先使用 `npm-shrinkwrap.json`、`package-lock.json`、`yarn.lock`。lock 中的版本满足 `package.json` 范围时，npm 使用 lock 中的精确版本；不满足时会重新解析并更新 lock。[npm install](https://docs.npmjs.com/cli/v11/commands/npm-install)
2. `npm install <name>@<version>` 要求安装指定版本（未发布则失败）；未指定版本/标签时，npm 会按当前 Node 版本的 `engines` 优先选择兼容版本，但显式指定版本可绕过这一选择。[npm install](https://docs.npmjs.com/cli/v11/commands/npm-install)
3. `npm update` 默认把包更新到满足现有 semver 范围的版本，且默认不改直接依赖在 `package.json` 中的 semver 值；需要同时改 manifest 时使用 `npm update --save`。[npm update](https://docs.npmjs.com/cli/v11/commands/npm-update)
4. `package-lock.json` 描述已生成的精确依赖树，使后续安装可重建相同依赖，并提供回到以前 `node_modules` 状态的能力。[npm package-lock](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json)
5. `npm ci` 要求已有 lockfile，要求 lock 与 `package.json` 匹配；它会先移除已有 `node_modules`，不会写 `package.json` 或 lockfile，属于 frozen install。[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)
6. `engines.node`/`engines.npm` 默认是 advisory；作为依赖安装时通常只产生 warning。设置 `engine-strict=true` 后，npm 会拒绝安装声明与当前 Node 不兼容的包；npm 文档也说明可用 `--force` 覆盖。[package.json `engines`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#engines)、[npm `engine-strict`](https://docs.npmjs.com/cli/v11/using-npm/config#engine-strict)

### 能保证与不能保证

| 机制 | 能保证的范围 | 不能保证的范围 |
|---|---|---|
| `pkg@x.y.z` | 解析到指定已发布包版本（依赖仍受其 manifest/lock 规则影响） | 不能撤销该版本已执行的数据库迁移、数据写入或副作用 |
| lockfile / `npm ci` | 在匹配的 npm/Node/平台条件下重建记录的依赖树 | 不能保证所有平台原生模块行为、运行时数据兼容或业务迁移可逆 |
| `npm update` | 按 semver 范围更新依赖，并按 npm 规则更新 lock | 不是数据库迁移器，也不是可靠的“回滚到上一个可用数据状态” |
| `engines` | 警告或在 `engine-strict` 下阻止声明不兼容的 Node/npm 组合 | 不校验 `node:sqlite` 的具体 API用法，不校验已有数据库 schema，也不能阻止 `--force` 或手工运行不兼容版本 |

- **架构建议**：升级记录必须同时保存应用包精确版本、lockfile/依赖树、Node/npm 版本、数据库 `application_id`/`user_version` 与备份路径。降级包只解决代码/依赖树，不解决数据回滚；要回到旧 schema，必须恢复匹配旧二进制的数据库快照，或另行实现经过验证的逆迁移。

## 4. Pi package 与 Session JSONL 的独立所有权核验

### Pi package

- Pi package 可来自 npm、git 或本地路径；带版本的 npm spec 会被 pin，并在 package update 时跳过。`pi update --all` 可更新 Pi、包并协调 pin 的 git ref；文档描述的是资源来源和安装/更新，不是数据 schema 兼容协议。[Pi packages 官方文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md#install-and-manage)、[Pi package sources](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md#package-sources)
- **事实核验结果**：该 package 文档没有声明 npm package 的 schema downgrade、跨版本数据兼容或安装前自动备份承诺。Pi package 的版本 pin 只能独立控制资源/代码版本。

### Session JSONL

- Session 是 JSONL，每行是带 `type` 的 JSON 对象；文件头包含 `version`。官方文档记录：v1 是线性序列，v2 加入 `id`/`parentId` 树结构，v3 将 `hookMessage` role 改名为 `custom`；现有 Session 加载时自动迁移到当前 v3。[Pi Session format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md#session-version)
- 官方源码定义 `CURRENT_SESSION_VERSION = 3`，实现 v1→v2、v2→v3 的单向迁移；加载后若发生迁移会重写整个 JSONL 文件。[Pi `session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)
- 源码中 `version >= CURRENT_SESSION_VERSION` 直接返回“不迁移”；解析器会跳过无法 JSON.parse 的行。源码没有逆向迁移函数，也没有把未来版本显式拒绝为“不兼容”的承诺。[Pi migration source](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)
- **事实核验结果**：Pi 官方资料提供的是“旧 Session 向当前版本自动迁移”的实现事实，不是“当前/未来 Session 可被任意旧二进制读取或 downgrade”的保证。package 版本 pin 与 Session 文件 schema 版本是两种独立所有权，不能互相替代。

## 5. 建议的安全 pre-migration backup、失败恢复与旧二进制策略

以下是架构建议，不是 Node、SQLite、npm 或 Pi 的官方承诺。

### pre-migration backup

1. 先做运行时门禁：确认 Node `>=22.19.0`（使用 `node:sqlite` backup API 时），确认 `application_id` 属于本应用，读取 `user_version` 并判断迁移路径；同时记录应用精确包版本、Node/npm 版本及 lockfile 内容/摘要。
2. 对 `app.sqlite3` 获取应用级维护锁，停止所有写者并等待进行中的事务结束。Session JSONL 由 Pi 独立拥有时，不要把 JSONL 当作 SQLite 事务的一部分；为它单独记录/复制对应的文件快照。
3. 优先用已打开的 `DatabaseSync` 调用 `sqlite.backup()` 写入**新的、版本化且不可覆盖的目标文件**。目标生成后，用独立连接验证可打开、`PRAGMA integrity_check`、`application_id`、`user_version` 和关键 schema 指纹；保留备份，不要只依赖 WAL 文件。
4. 若需要压缩/清理已删除内容，可用 `VACUUM INTO`；目标必须为空/不存在，并把“输出完成且已同步”作为成功条件。不要在 WAL 活跃期间直接复制主文件；若采用停机物理复制，必须确保所有连接/事务已结束，并不混用旧的 `-wal`/`-shm`。
5. 备份验证完成后再执行迁移；迁移每一步应有明确目标版本和幂等检查，能放进 SQLite 事务的 schema/data 变更放在同一事务中，并在成功提交时更新 `user_version`。破坏性变更前保留足够长的备份保留期。

### 失败恢复

- 迁移事务在 commit 前失败：回滚事务，保留原库；不需要用备份覆盖仍一致的原库。
- 进程崩溃后：停止所有写者，先用 SQLite 打开并做完整性/schema/版本检查；不要直接删除疑似热的 WAL/日志文件。SQLite 要求恢复所需的日志与原数据库保持原名/配对。[SQLite corruption guide](https://sqlite.org/howtocorrupt.html#deleting_a_hot_journal)
- 数据库无法验证或已提交了不可接受的半迁移状态：进入维护模式，停止所有连接，用**同一批次的 pre-migration snapshot**恢复；恢复时替换成完整快照，并清除/隔离不属于该快照的配套 `-wal`/`-shm`，禁止拼接不同时间点的文件。恢复后再次做完整性、`application_id`、`user_version` 和应用读路径验证。
- Pi JSONL 失败：把原 JSONL 保留为只读/备份，使用 Pi 自己的 SessionManager 加载验证；不要用 SQLite 回滚策略覆盖 Pi 的独立文件，也不要假定 JSONL 的重写迁移可逆。

### 旧二进制遇到新 schema 的通行策略

1. 每个二进制声明 `minSupportedSchema`/`maxSupportedSchema`（实际持久化在 `user_version`，并校验 `application_id`）。启动时若 `user_version > maxSupportedSchema`，**fail closed**：不写库、不自动降级、不运行可能破坏新 schema 的旧迁移，只提示安装支持该版本的二进制或恢复匹配快照。
2. 采用“前向迁移、显式版本门禁、备份恢复”而不是依赖逆迁移。只允许已验证的旧→新路径；不要把“新增列通常可被旧查询忽略”当作兼容承诺，因为约束、索引、触发器和业务语义仍可能改变。
3. 应用回滚应是成对操作：选择旧二进制 + 该二进制支持的数据库快照 + 对应 Pi Session 处理策略。`npm install pkg@old`/`npm ci` 只恢复软件依赖树；若没有数据快照，不能声称完成数据库回滚。
4. 对 Pi Session，旧版本能否读取未来版本必须通过目标旧二进制的真实打开/读路径测试；在没有官方 downgrade 承诺的前提下，安全默认是阻止旧版本写入未来 Session，并使用备份、导出或由新版本生成的兼容投影，而不是直接编辑降版本号。

## 来源索引

- [Node.js v22.19.0 `node:sqlite`](https://nodejs.org/download/release/v22.19.0/docs/api/sqlite.html)
- [SQLite Backup API](https://sqlite.org/backup.html)
- [SQLite WAL](https://sqlite.org/wal.html)
- [SQLite VACUUM](https://sqlite.org/lang_vacuum.html)
- [SQLite PRAGMA](https://sqlite.org/pragma.html)
- [SQLite File Format Changes](https://sqlite.org/formatchng.html)
- [SQLite How To Corrupt Your Database](https://sqlite.org/howtocorrupt.html)
- [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install)、[npm update](https://docs.npmjs.com/cli/v11/commands/npm-update)、[npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)
- [npm package.json `engines`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#engines)、[npm `engine-strict`](https://docs.npmjs.com/cli/v11/using-npm/config#engine-strict)、[package-lock.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json)
- [Pi packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)、[Pi Session format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md)、[Pi session-manager source](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)
