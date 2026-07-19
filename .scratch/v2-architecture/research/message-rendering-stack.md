# Wayfinder 消息 Markdown 渲染栈研究

## 结论

推荐 **markdown-it + 项目自有 Vue 3 token/VNode 适配器 + Shiki**：

- `markdown-it` 只做 Markdown 词法/块内联 token 化；初始化为 `html: false`，关闭 `linkify`、`typographer`，只加入审计过的插件。
- `MessageMarkdown` 用 `md.parse()` 的 token 树生成 Vue VNode/项目自有组件，而不是把 agent 原文或任意 parser HTML 交给 `v-html`。文本作为 Vue text node；标签、属性、链接协议、代码块均由 allowlist 控制。
- Shiki 用 `codeToTokens`，长期复用一个 highlighter；常用语言和 light/dark 主题按需加载，token 作为 Vue `span` 渲染。未知语言降级为纯文本。
- 不引入 React、SSR 专用包或黑盒 Vue Markdown 组件；这保留 Apple-derived UI、Reka UI/shadcn-vue/Tailwind v4 的项目拥有权。
- **不把 DOMPurify 放入默认路径。** 只要不启用原始 HTML、不要使用会生成任意 HTML 的插件，并采用 token/VNode 输出，agent 文本不具备 HTML 注入路径。若未来允许 raw HTML，或必须使用 `v-html`，在最终插入前用 DOMPurify 严格清理。

这是针对当前 Vue 3 + Vite SPA、无 SSR、非可信 agent 输出的推荐，不是说任何 Markdown renderer 都天然安全。

## 研究边界与来源

先用 Context7 查询了 markdown-it、Shiki、DOMPurify、Marked、highlight.js 和 Vite 的当前官方文档/源码；再用 agent-reach 的 Exa 路由定位官方页面，并回到一手来源核验。未采用博客、测评或社区评论。

## 已核验事实

### Markdown 解析与 Vue 适配

- [事实] markdown-it 默认 `html: false`；官方安全说明把“禁用 HTML、用插件扩展”列为推荐策略。默认还会拒绝 `javascript:`、`vbscript:`、`file:` 等危险链接协议，`data:` 只允许部分图片类型。启用 HTML 后，官方要求使用外部 sanitizer。[markdown-it API](https://markdown-it.github.io/markdown-it/)；[markdown-it safety](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)
- [事实] markdown-it 的 `render()` 产生 HTML，renderer rules 也可以生成别的表示（例如 AST）；token 含有类型、嵌套级别、内容和属性，适合项目自有 token→VNode 适配器。[architecture](https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md)；[renderer rules](https://github.com/markdown-it/markdown-it/blob/master/docs/examples/renderer_rules.md)
- [事实] Marked 明确声明“不清理输出 HTML”，对不可信输入必须在输出 HTML 上使用 DOMPurify 等 sanitizer；每次 `parse()` 都重新执行完整 lexer/parser pipeline，没有内建增量/streaming 输出。[Marked README](https://github.com/markedjs/marked/blob/master/README.md)；[Marked source](https://github.com/markedjs/marked/blob/master/src/Instance.ts)
- [事实] Vue 官方警告 `v-html` 会把字符串当作 HTML 解释，任意 HTML 很容易造成 XSS，只应对可信内容使用，不能直接用于用户提供内容。[Vue template syntax](https://vuejs.org/guide/essentials/template-syntax.html#raw-html)
- [事实] Vue 官方 VitePress 源码确实使用 markdown-it 和 Shiki，并加上代码复制按钮、代码块 `tabindex` 等产品行为；但 VitePress 文档源是受信任内容，其 `html: true` 不能复制到 agent transcript。[VitePress markdown source](https://github.com/vuejs/vitepress/blob/main/src/node/markdown/markdown.ts)

**比较判断：** markdown-it 比 Marked 更适合作为安全默认，因为禁用 HTML 即可封闭主要注入面；Marked 不是不能用，但会强制每次输出走 DOMPurify。Vue-compatible 不等于必须安装一个 Vue renderer：parser 无框架依赖，项目自己的 token/VNode adapter 更符合本项目 UI ownership 和安全要求。

### Syntax highlighting

- [事实] Shiki 基于 TextMate grammar；`createHighlighter()` 异步初始化指定主题/语言后，实例上的 `codeToHtml` 可同步调用。官方建议 highlighter 长期复用，不要在热路径/循环中反复创建。[Shiki install](https://shiki.style/guide/install)
- [事实] Shiki 提供 `codeToTokens`/`codeToHast`，因此可以取 token/HAST 自行渲染，而不必把高亮 HTML 直接注入 DOM。[Shiki install](https://shiki.style/guide/install)
- [事实] Shiki 的语言和主题可以动态导入；fine-grained bundle 只打包选择的语言/主题，官方 web bundle 文档给出全量 web bundle 约 3.8 MB minified、695 KB gzip（async chunks included）的量级，并建议 Web 应用使用 fine-grained bundle。[Shiki bundles](https://shiki.style/guide/bundles)；[Shiki performance](https://shiki.style/guide/best-performance)
- [事实] Shiki 的轻量化 JavaScript engine 可减少 bundle/startup 成本；Oniguruma engine 是 WebAssembly。[Shiki performance](https://shiki.style/guide/best-performance)
- [事实] highlight.js 可以只导入 core 和指定语言，或使用 `highlight()` 明确语言；无语言时的 `highlightAuto()` 会尝试自动识别。其 DOM API 会把结果 HTML 写回 `innerHTML`，并对未转义 code children 给出安全警告。[highlight.js README](https://github.com/highlightjs/highlight.js/blob/main/README.md)；[highlight source](https://github.com/highlightjs/highlight.js/blob/main/src/highlight.js)

**比较判断：** Shiki 语法准确度和主题质量更适合 coding-agent 的代码/diff/terminal 内容；它的代价是 WASM/grammar 和异步加载。highlight.js 是更轻的替代，适合只需少量语言和普通展示，但不要启用自动识别作为默认（耗时、结果不稳定），且其 HTML 输出仍不能未经约束直接进入 `innerHTML`。纯 `pre/code` 是最轻、在 streaming 中最稳定的初始降级。

### Sanitization 与安全边界

- [事实] DOMPurify 是浏览器 DOM-based HTML sanitizer，可清理 HTML/MathML/SVG；官方警告“清理后再修改”或交给会重新解析/改变上下文的库可能使清理失效。它支持 Trusted Types，但配置仍需安全审查。[DOMPurify README](https://github.com/cure53/DOMPurify/blob/main/README.md)；[security goals](https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model)
- [事实] DOMPurify 的服务器用法依赖 DOM 实现，旧 jsdom 可能引入 XSS；本项目是浏览器 SPA，不需要为 SSR 引入这条复杂性。[DOMPurify README](https://github.com/cure53/DOMPurify/blob/main/README.md#running-dompurify-on-the-server)
- [事实] markdown-it 也提醒插件可以制造 DOM clobbering 等问题，依赖用户输入生成 `id`/`name` 时必须加前缀并审计。[markdown-it safety](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)

**安全规则（必须落成测试/代码审查项）：**

1. agent 原文永远作为数据，不作为模板，不直接传给 `v-html`/`innerHTML`。
2. markdown-it 固定 `html:false`；禁止 raw HTML、脚本、iframe、SVG/MathML、事件属性和未经审计的 HTML-emitting plugin。
3. 链接 renderer 只允许 `https:`, `http:`, `mailto:`（需要时再允许 `tel:`），拒绝其他 scheme；外链按项目策略设置 `rel="noopener noreferrer"`，不让 Markdown 自由提供任意属性。
4. token→VNode 只允许固定标签和属性；heading anchor 使用前缀、稳定 ID，避免 clobbering；图片如未来开放，限制协议、尺寸和加载策略。
5. 代码复制取原始 code text，不复制高亮 DOM。Shiki 代码 token 只来源于 code fence 文本。
6. 若未来必须开放 raw HTML 或 fallback 到 HTML renderer：最终写入 DOM 前运行 DOMPurify，使用最小 HTML profile，明确禁止 SVG/MathML、事件属性和不需要的 URL 协议；清理后不再经过会改写 HTML 的库。可配 Trusted Types，但它不是 sanitizer 的替代品。

### Streaming、复制和可访问性

- [事实] markdown-it 和 Marked 的标准 `render/parse` 都是对当前完整字符串重新解析；两者不提供 token-by-token 增量渲染。[markdown-it API](https://markdown-it.github.io/markdown-it/)；[Marked source](https://github.com/markedjs/marked/blob/master/src/Instance.ts)
- [事实] Vite 支持 `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` 形式的 Worker/SharedWorker 构造，并能用动态 import 做分包。[Vite features](https://github.com/vitejs/vite/blob/main/docs/guide/features.md)；[Vite dynamic import example](https://github.com/vitejs/vite/blob/main/playground/dynamic-import/nested/index.js)
- [事实] Web Worker 在后台线程运行脚本，通过 `postMessage` 与主线程通信，不阻塞 UI 线程。[MDN Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [事实] `navigator.clipboard.writeText()` 返回 Promise，只在 secure context 可用，权限不足会失败；复制按钮应处理失败状态。[MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)
- [事实] WAI-ARIA Button Pattern 要求按钮有可访问名称，聚焦时 Enter/Space 激活；复制/重试/展开等动作应使用原生 `<button>`，而不是伪装成链接或仅可点击的 `<div>`。[W3C APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)

**推荐 streaming 实现：**

- Store 同时保存 `rawMarkdown`、最终 token/VNode projection 和 `isStreaming`；每个消息有稳定 key。流式 chunk 只追加到 raw buffer，不能每 token 触发一次完整高亮。
- 当前可见 assistant 消息以约 50–100 ms 合并更新（或一帧一次，取两者较慢者），最终 chunk 到达后立即做一次 final parse/highlight。用版本号/AbortController 丢弃过期的异步 Shiki 结果。
- 未闭合 fence、列表和 emphasis 在流式中允许暂时降级；不要为修饰完整语法而引入危险 HTML。已关闭且未变化的代码块缓存 token；stream 中的大 code block 先用纯 `pre/code`，结束后再 Shiki。
- 首版先在主线程完成：markdown-it 解析通常比高亮轻，且避免 Worker 通信和顺序竞态。把解析/token 化和 Shiki 搬到 Vite module Worker 作为按需升级，而不是默认复杂化。
- 复制按钮放在代码块外层 toolbar；使用有文本或 `aria-label="复制代码"` 的 `<button>`、44px hit target、可见 focus ring；成功/失败通过短暂文字和 `aria-live="polite"` 告知，不抢焦点。`pre`/表格等需要横向滚动时保持键盘可达。

### Long transcript 与 virtualization

- [事实] Vue 官方指出，数千列表项会因 DOM 节点数量导致性能问题；virtualization 只挂载视口附近项。Vue 同时建议大列表使用稳定 `key`；`v-memo` 的典型场景是长度超过 1000 的大 `v-for`，但它不是 virtualization 的替代品。[Vue performance](https://vuejs.org/guide/best-practices/performance.html)；[Vue list rendering](https://vuejs.org/guide/essentials/list.html)；[Vue built-in directives](https://vuejs.org/api/built-in-directives.html#v-memo)
- [事实] Vue 官方还指出，深层响应式开销在一次渲染访问约 100,000+ properties 的大数组时才通常明显；可用 `shallowRef` 作为 immutable 大结构的逃生口。[Vue performance](https://vuejs.org/guide/best-practices/performance.html)

**本项目的工程阈值（不是框架保证）：**

- 初版不做 transcript virtualization。先用稳定 key、消息级 memo/不可变 projection、折叠 tool output、按需高亮和旧消息分页；这更容易保证“跳转到消息”、键盘焦点、流式自动滚动和变高消息的正确性。
- 先压测 300 条消息、约 1 MB 原始 Markdown、10,000 个 block/VNode 的 transcript。若任一场景出现 p95 append-to-paint >16 ms、持续长任务 >50 ms、滚动低于约 55 FPS、或内存随滚动持续增长，再引入 variable-height virtualization。
- 解析/高亮升级 Worker 的起点：单条消息约 100 KB，或连续 3 次更新的 parse+highlight 超过 8 ms；若 Worker 首屏延迟明显高于主线程，则只把 Shiki/language loading 放 Worker，Markdown token 化仍留主线程。
- 重新评估触发器：真实会话常态超过 500 条消息、后台 session 合并进入同一 transcript、代码块/工具输出占主要 DOM，或性能预算在中端设备上失败。Virtualization 不能按“消息数量”盲启用，必须验证动态高度、滚动锚点、查找/复制、焦点和流式底部保持。

## 方案取舍

| 方案 | 安全 | Streaming | Bundle/运行时 | 决策 |
|---|---|---|---|---|
| markdown-it + token/VNode + Shiki | 默认禁 HTML；allowlist 清晰 | 需自己节流，但可复用 token/代码块 | Shiki 可细粒度懒加载 | **选用** |
| markdown-it + `v-html` + DOMPurify | 可做，但 sanitizer 成为关键依赖 | 全文输出重建 | 实现较快，运行时多一次清理 | 仅作受控 fallback |
| Marked + DOMPurify | Marked 不提供安全输出 | 同样全文 parse，无内建增量 | 轻量，扩展简单 | 不选为默认 |
| highlight.js core | 可很轻，需自己约束 HTML | 快速但自动识别不稳定 | 适合少量语言 | 作为 Shiki 加载失败/轻量模式备选 |
| 专用 Vue streaming renderer | 可能带自己的安全/虚拟化策略 | 开箱即用但行为不可控 | 引入产品 UI 和 parser 绑定 | 不选；项目需拥有 Apple-derived transcript |

## 最终推荐

选择 **markdown-it（安全配置）+ 项目自有 Vue token/VNode renderer + Shiki（细粒度懒加载）**。默认不引入 DOMPurify，不启用 raw HTML；只有产品明确要支持受信任 HTML/第三方 HTML renderer 时才加入 DOMPurify。以节流的完整消息重算满足首版 streaming，先不做 virtualization；以 300 消息/1 MB/10,000 blocks 的压测和 16 ms/50 ms 性能指标决定后续 Worker 或虚拟化。