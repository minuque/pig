# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **主要用户**：自己日常用 Pi agent 的开发者。一天里反复开、切、并行跑多个会话，最在意切换成本、长会话的阅读手感、以及不丢会话。
- **熟悉终端的开发者**：已经把 `pi` 当日常工具，要 GUI 补的是多会话管理、diff 与审批、可读性，不是包一层命令行。
- **非终端用户**：不熟命令行，靠这个界面完成全部 agent 交付工作；首次启动、空状态、出错恢复必须自己走通。

## Product Purpose

本机的 Pi agent 图形工作台。把已有会话、项目目录、模型连接和扩展能力聚到一个窗口里，让人并行推进多件事，并随时看清每个会话在做什么。成功的样子是：切会话比开终端快，长会话读得下去，跑着的活儿不会因为没有可见状态而丢掉。

## Positioning

轻量、高性能的多会话并行工作台，完全继承本机已有的 pi 会话，直接基于 pi agent SDK 构建。它不重新实现 agent，也不内置工具集：把 Pi 的能力原样接到界面上，额外只做编排与会话管理。同类 GUI 通常会自带一套工具或云端会话，这里两者都不做。

## Operating Context

- 桌面优先。Electron 外壳，界面是同一套 Web 实现。Windows 自画标题栏与窗口按钮；macOS 保留原生红绿灯；Linux 保留原生边框与窗口管理器行为。Windows 用 acrylic 材质。
- 所有状态留在本机：会话、`~/.pi/agent/auth.json` 凭据、`models.json`、skills 与 extensions 与 pi CLI 共用，换到 GUI 不用重新配置。
- 前端经 `@pig/gateway` 连 Pi agent，不走云端；浏览器模式的用途是开发与自托管，不是主发布形态。
- 界面默认简体中文，可切英文。
- 按工作目录把会话分成项目，跨项目来回切是常态。

## Capabilities and Constraints

- 会话：新建、置顶、重命名、删除；按日期或工作目录分组；按最近更新或创建时间排序；侧栏标出运行中、未读、草稿。
- 工作台：流式 transcript、思考区块、diff 渲染、待发队列、附件（有单文件大小与数量上限）、停止当前 turn。
- 模型：供应商连接（API Key 或 OAuth 订阅登录）、自定义 provider 与模型写入 `models.json`、思考强度与采样参数、连接测试、用量查看。
- 设置：外观（浅色 / 深色 / 跟随系统、8 套强调色、字号、文字对比度、半透明窗口）、语言、系统通知与完成提示音、skills、extensions。
- 已知缺口（记录在 `docs/ISSUES.md`，尚未实现）：会话归档、retry 详情、thinking 精确时长、streaming 期间的实时 token 计数。
- 数据契约在 `pi-protocol` schema 与 gateway：界面拿不到的事实先补协议与 gateway，不在前端造数据。

## Brand Commitments

- 名称 `pig`，logo 与 PWA 图标在 `apps/web/public/`。
- MIT 许可。
- 定位叙述、快速开始与配置项以 `README.md` / `README.en.md` 为准，架构边界以 `ROADMAP.md`、`docs/directory-structure.md` 为准。
- 界面文案以中文为主，英文为对等翻译；改动文案要两边同时成立。

## Evidence on Hand

- 真实素材：`apps/web/public/logo.png`、`logo-pig.png`、`logo-bg.png` 及 PWA 图标。
- 真实素材：仓库内的 README、ROADMAP、`docs/` 说明与界面文案本身就是产品说明来源。
- 没有用户评价、客户案例、基准数据、定价页。后续工作不得编造这些内容。

## Product Principles

1. 会话是本机资产。界面读取、编排、呈现它，不搬走也不另存一份。
2. 并行优先。多个会话同时跑是常态，每个会话的状态必须一眼可辨。
3. 不内置工具。能力来自 Extension API，界面不加自己的工具层。
4. 长会话要读得下去。流式输出、长列表和滚动的手感优先于装饰。
5. 陌生人也能走通。不要求用户懂终端，空状态和出错路径要自己解释清楚。
