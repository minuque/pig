# 文件搜索的遍历上限与远端实现

- 状态：已采纳
- 代码：`packages/environment/src/search.ts`（`MAX_DEPTH`、`MAX_VISITED`、`SKIP_DIRS`、`rankEntries`）、`packages/environment/src/ssh.ts`（`SshEnvironment.search`、`FIND_COMMAND`、`parseFindOutput`）

## 背景

`@` 文件引用与文件搜索只消费排好序的头部结果，用户不会翻到几千条之后。远端逐目录走 SFTP 时，每下一层都要一次往返，深仓库里搜索会慢到不可用。本机与远端必须给出同一批候选，否则同一份代码在两种环境下补全结果不同。

## 决定

- 遍历深度上限 8 层、访问节点上限 20000，超出直接截断。
- 两端共用一套裁剪规则：根下的隐藏项只留 `.pi`，`SKIP_DIRS` 里的目录列为候选但不下探，目录路径带尾斜杠。
- 远端用一次 `find` 把候选全部列回本地（`FIND_COMMAND`），由 `rankEntries` 在本地打分排序；不下探 SFTP。
- 打分只看路径：命中越靠开头、越连续、词首命中，分越高；同分短路径优先。

## 后果

深树截断不影响头部候选质量，搜索延迟与仓库深度解耦。代价是本机 `walk` 与远端 `FIND_COMMAND` 是同一套规则的两份实现，改裁剪规则必须同时改两处，否则两端补全结果不一致；`find | head` 截断时退出码非零，`SshEnvironment.output` 因此不看退出码。
