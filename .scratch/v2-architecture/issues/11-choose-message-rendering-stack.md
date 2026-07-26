# Choose the message rendering stack

Type: research
Status: resolved
Blocked by:

## Question

Which Vue-compatible Markdown, syntax-highlighting, sanitization, streaming-update, copy/accessibility, and long-transcript strategy best fits project-owned DESIGN.md components without introducing React, SSR, unsafe HTML, or premature virtualization?

## Answer

选择 **markdown-it（`html: false` 安全配置）+ 项目自有 Vue token/VNode renderer + Shiki**。agent 原文只作为数据，不进入 `v-html`/`innerHTML`；仅允许审计过的 Markdown token、链接协议和属性。默认不引入 DOMPurify；只有未来开放 raw HTML 或必须使用 HTML renderer 时，才在最终插入前用严格配置的 DOMPurify，清理后不得再次改写。Shiki 使用长期复用的 highlighter、细粒度懒加载语言/主题，未知语言降级纯文本；highlight.js 仅作轻量备选。

流式输出追加 raw buffer，以约 50–100ms 合并解析，最终 chunk 立即 final render；缓存未变化代码块，异步结果按版本丢弃。首版主线程，不做虚拟化；单消息约 100KB 或连续 3 次 parse/highlight 超过 8ms 再评估 Worker。先压测 300 条消息/1MB Markdown/10,000 blocks；只有 p95 更新超过 16ms、长任务超过 50ms、滚动低于约 55 FPS或内存持续增长时才引入变高 virtualization。复制使用原生 `<button>`、可访问名称、focus ring、`aria-live` 状态和 Clipboard API；代码复制原文而非高亮 DOM。

组件结构参考 [AIcss](https://www.aicss.dev/#components) 的 Codex-like transcript grammar；其 Vue copy-paste variants 可在许可证核验后作为实现起点，但必须接入同一安全 token/VNode renderer、Pi/Gateway types、无障碍规则和 `DESIGN.md` tokens。该参考不扩大 v1 内容类型，也不引入 AIcss 运行时依赖。

详细事实、比较、来源与安全规则见 [research/message-rendering-stack.md](../research/message-rendering-stack.md)。