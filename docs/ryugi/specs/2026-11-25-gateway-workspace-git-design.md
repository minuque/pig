# git 状态归 gateway 管：设计稿

2026-11-25 根据「会话导航头部改为 toolbar 风格」对话里的方案写成。标「我定的」的是设计者自定、用户未逐条确认的取舍。

## 1. 目的

现在侧栏的分支信息比会话列表晚到一拍。会话列表跟着 `hello` 里的 `ServerSnapshot` 一起到达，侧栏先按两行渲染。分支要等连上以后前端再发 `GET /api/v1/platform/workspace-git` 才拿到。这个请求先 `refreshSessionPaths()` 扫会话文件，再逐个目录读 `.git`。结果回来后，带分支的会话从两行跳成三行。

用户的要求：从长远方案入手，不用前端缓存。所以 git 状态由 gateway 持有，只有这一处来源：首次快照直接带上，之后有变化就主动推送。前端只渲染收到的数据。

gateway 把「上次已知」的结果落盘，启动时先读回内存。这样 gateway 冷启动时快照也能马上带上分支，实读校验后有变化再推送。显示语义不变，仍是「目录现在所在的分支」。

## 2. 范围

要做：

- gateway 新增常驻内存的 `WorkspaceGitStore`，负责读取、缓存、落盘、监听、推送。
- `ServerSnapshot` 加 `workspaceGit` 字段；新增事件 `workspace_git_changed`。
- 前端从快照与事件取数据；删掉 HTTP 拉取与窗口获得焦点时的重拉。
- 删掉 `GET /api/v1/platform/workspace-git` 路由、`listWorkspaceGit()`（gateway 与 web 两处）和对应的协议类型。

不做：

- 不改 `readGit` / `findGitDir` 的解析逻辑，也不改侧栏的渲染（`SessionItem`、`SessionRowMarks`、`SessionHoverCard`）。
- 不显示 dirty、ahead/behind 这类状态，只显示分支、分离 HEAD、worktree 三项，和现在一样。
- 不给远程目录做文件监听。
- 不把分支记到会话上。t3code 的做法是线程自带分支字段，目录切走时再提示不一致。这是另一种语义，以后单独做。

## 3. 数据形状

`packages/protocol/src/wire.ts`：

```ts
export interface ServerSnapshot {
  // 现有字段不变
  workspaceGit: Record<string, WorkspaceGit>
}

export type ServerEvent =
  // 现有事件不变
  | { type: "workspace_git_changed"; changes: Record<string, WorkspaceGit | null> }
```

键是 `canonicalizePath(cwd)`，与 `SessionMetadata.cwd` 一致（`service.ts:126` 已经做了同样的规范化），所以前端可以直接用 `item.cwd` 去查。`null` 表示这个目录不再是 git 仓库，前端收到后删掉这个键。快照里不在仓库中的目录不出现。

`Command` 新增 `{ command: "refresh_workspace_git" }`，结果是 `{ command: "refresh_workspace_git" }`。它不直接返回数据，读到的变化仍然走 `workspace_git_changed`。

## 4. gateway：`WorkspaceGitStore`

新文件 `packages/gateway/src/pi/workspace-git-store.ts`，`readGit` / `readWorkspaceGit` 继续放在 `workspace-git.ts`。

状态：`Map<目录, WorkspaceGit>` 保存已知结果；另有一份本地目录的监听表，键是被监听的 HEAD 文件所在的目录。

接口：

- `constructor(path)`：落盘文件路径，见下文「落盘」。
- `load()`：把落盘文件读进内存。
- `snapshot(): Record<string, WorkspaceGit>`：同步返回当前缓存，不等待读取。
- `track(workspaces: string[])`：传入当前全部会话目录。新目录读一次，并为本地目录挂上监听。不再出现的目录关掉监听并移出缓存（我定的：会话全部归档或删除后，侧栏本来也不显示它，不用推 `null`）。
- `refresh(workspaces?: string[])`：重新读给定目录（默认全部远程目录），与缓存比较，有变化就通知。
- `onChange(listener)`：变化时回调，参数就是 `changes`。
- `close()`：关闭全部监听。

读取规则：

- 结果与缓存相同就不通知。多个目录在同一轮里变化时，合成一次 `changes` 通知。
- 读失败按「不是仓库」处理，与现在 `listWorkspaceGit` 里的 `.catch(() => undefined)` 一致。
- 同一个目录同时只跑一次读取；读的时候又来了请求，就在这次读完后再补读一次。

本地监听：

- `findGitDir` 找到的 gitDir 下面的 `HEAD` 就是要监听的文件。普通仓库是 `<repo>/.git/HEAD`，worktree 是 `<主仓库>/.git/worktrees/<名字>/HEAD`。为此 `findGitDir` 要导出，或者让 `readGit` 把 gitDir 一并返回（我定的：让 `readGit` 内部返回 `{ git, headPath }`，对外的 `WorkspaceGit` 不变）。
- git 换分支时是先写临时文件，再改名覆盖 HEAD，所以要监听 HEAD 所在的目录，再按文件名过滤，与 `session-watcher.ts:81` 的做法相同。防抖沿用同一个思路，取 100ms（我定的）。
- 多个会话目录指向同一个仓库（比如子目录）时，它们共用一个监听；触发时重读所有指向它的目录。
- 监听报 `error`（目录被删、`.git` 被删）时关掉这个监听，再重读一次受影响的目录。结果变成「不是仓库」就推 `null`。目录之后再变回仓库时，由下一次 `track` 或 `refresh` 补上。
- 目录还不是仓库时不挂监听。用户在已有会话的目录里 `git init` 后，要等下一次 `refresh`（窗口获得焦点）或 `track` 才会显示（我定的：没有真实需求前不去监听整个目录树）。
- 监听器 `unref()`，不拖住进程退出。

落盘：

- 文件是 `pigHomeFile("workspace-git.json", sessionDir, pigHome)`，和 `session-archives.json` 放在一起。内容是 `{ version: 1, workspaces: Record<string, WorkspaceGit> }`。
- 用 `pig-file.ts` 的 `writeJsonAtomic` 写。缓存每次变化（包括 `track` 移出目录）后防抖写一次，取 500ms（我定的）。`close()` 时如果还有没写的内容，立刻写一次。
- 文件缺失、读不出、格式不对，都按空缓存处理，不报错，下次写入时覆盖（我定的：它只是缓存，实读就能重建，不是用户数据，所以不照 `SessionArchivesCorruptedError` 那样报错）。
- 读回的条目只是初值。`track` 照常对每个目录实读一次，结果和读回的值不同就推送，相同就不推。
- 读回后、`track` 之前，文件里有、但会话里已经没有的目录，在第一次 `track` 时移出，和平时的规则一样。

远程目录（`workspaceEnvironment(workspace).env.id !== "local"`）：

- 不监听。在两个时机重读：前端发 `refresh_workspace_git` 时；以及该目录里的会话一轮结束（phase 回到 `idle`）时，只重读这一个目录。
- 首次读放到后台进行，不阻塞别的目录。

## 5. 接进 gateway 的生命周期

- `PiHostService` 持有这个 store，路径从 `sessionDir` / `pigHome` 推出，和 `host.ts:53` 构造其他 store 的方式一致。
- `host.start()` 在 `listen` 之前 `await` store 的 `load()`。这样第一条连接拿到的快照一定已经带上读回的值。文件只有几 KB，耗时可以忽略。
- `warm()` 里把会话目录交给 `track`，和现在读会话列表、模型列表的预热放在一起。`warm()` 本来就不阻塞 `listen`（`host.ts:187`），所以不加超时（我定的：快照本来就不等实读，读完再推送就能补上，不需要上限）。
- 会话列表变化时会走 `refreshSessionPaths()`，在这里把最新的目录集合交给 `track`。新建会话、在新目录开会话都会经过它。
- `ProtocolServer.serverSnapshot()` 里加 `workspaceGit: service.snapshotWorkspaceGit()`，从缓存同步取。
- `host.ts` 里照 `preferences.watch` → `broadcastPreferences` 的写法，新增 `broadcastWorkspaceGit(changes)`，只发给 `ready` 的连接。
- `live-sessions.ts` 处理 `refresh_workspace_git`：调 `refresh()`，读完再回 response。会话一轮结束的地方调 `refresh([cwd])`，仅限远程目录。
- `hostService.dispose()` 里调 `store.close()`。

时序：gateway 一开始监听，内存里就有读回的值，所以无论窗口什么时候连上，分支都和会话列表在同一帧出现。如果关闭期间切过分支，会先显示旧分支，实读完成后由 `workspace_git_changed` 更正，本地目录通常在毫秒级完成。只有两种情况仍会晚到一次：全新安装后第一次启动，以及新目录第一次出现时，因为这两种情况都还没有落盘的值。

## 6. 前端

- `gateway-client.ts`：处理 `workspace_git_changed`，新增 `onWorkspaceGitChanged(listener)`，写法照 `onSessionArchivesChanged`；新增 `refreshWorkspaceGit()` 发送命令。
- `use-session-cards.ts`：`workspaceGit` 的初值取自 `hello` / `server_snapshot` 里的 `snapshot.workspaceGit`，每收到一份快照就整体替换。收到 `workspace_git_changed` 时按键合并，`null` 删除对应键。窗口 `focus` 时改为调 `refreshWorkspaceGit()`，不再 HTTP 拉取。`loadWorkspaceGit` 删掉。
- `platform.ts` 删 `listWorkspaceGit`；`http.ts` 删对应路由类型。
- design-lab fixture 的分支场景不受影响；如果 fixture 自己构造了 `ServerSnapshot`，补上 `workspaceGit` 字段。

## 7. 测试

只测产品假设与数据路径：

- `WorkspaceGitStore`：真实临时仓库。改写 HEAD 后收到一次 `changes`，内容为新分支；删掉 `.git` 后收到 `null`；同仓库的两个子目录只挂一个监听，一次切换两个目录都更新；`track` 去掉某个目录后，不再收到它的变化。
- 落盘：用同一个文件新建第二个 store，`load()` 后在任何实读之前，`snapshot()` 已经有上次的分支；关闭期间改过 HEAD 的，`track` 后收到一次更正。文件损坏时 `load()` 不抛错，按空缓存处理。
- `snapshot-broadcast.test.ts` 一类的协议测试：`hello` 快照带 `workspaceGit`；store 有变化时 ready 连接收到 `workspace_git_changed`。
- web：`use-session-cards.test.ts` 里现有「连上后按目录建好分支表」这条，改为从快照建表，再加一条「收到变化事件后按键合并、`null` 删除」。
- 删掉随 HTTP 接口一起失效的用例。`workspace-git.test.ts` 的 4 条解析用例保留。

验收：`pnpm fix:touched` → `pnpm check:touched`，会带上侧栏 e2e。再用 `pnpm dev:desktop` 实测三件事：第二次冷启动时分支与列表同一帧出现；关闭期间切过分支，启动后先显示旧分支，随即更正；在终端里 `git switch` 后，侧栏在 1 秒内更新。

## 8. 留给实现者

- `WorkspaceGitStore` 内部的数据结构和文件拆分，只要功能代码文件不超过 500 行。
- 远程「一轮结束」的钩子挂在 `live-sessions.ts` 的哪个位置。
- 防抖的具体实现。

## 9. 来源

- 方案出自对话「会话导航头部改为 toolbar 风格」最后两轮（2026-11-24）：用户否决了前端 localStorage 缓存，要求长远方案；助手给出四步方案，本文按它细化。
- 落盘一节出自 2026-11-25 的后续讨论。t3code 把分支作为线程字段存在 SQLite 投影里，所以冷启动不缺数据。用户在「gateway 落盘目录缓存」（A）和「照 t3code 把分支记到会话上」（B）之间选了 A。
- 现有实现：`38ec0ad8`（gateway 接口）、`7665e87b`（侧栏显示）、`65e04589`（第三行间距）。
