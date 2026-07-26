# 09 — 安全渲染 Transcript

**What to build:** 用户可安全、稳定地阅读 message、thinking、tool、compaction、model change、notice 与 unsupported Transcript 项；流式 Markdown 平滑更新，代码可正确复制，阅读历史时不会被新 token 强制拖到底部。

**Blocked by:** 04 — 完成首个流式 Run

**Status:** ready-for-agent

- [ ] Transcript 公共类型为项目拥有的封闭联合，未知 Pi 内容显示为 unsupported 而不暴露 raw payload。
- [ ] Markdown renderer 禁用 raw HTML 和 `v-html`，并对白名单链接协议与属性执行校验。
- [ ] Shiki highlighter 可长期复用并按语言懒加载；复制代码得到原始代码文本。
- [ ] streaming buffer 以 50–100ms 合并解析，最终 chunk 立即完成且不会产生重复消息。
- [ ] 仅在用户接近尾部时自动跟随，并提供显式“跳转至最新”；thinking/tool 可展开或收起。
