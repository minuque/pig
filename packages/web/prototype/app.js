// THROWAWAY PROTOTYPE — 三个本地 Pi 工作台变体，通过 ?variant=A|B|C 切换。
const variants = {
  A: "三栏工作台",
  B: "专注会话",
  C: "运行画布",
};

const sessions = [
  { name: "重构 Gateway 契约", meta: "Running · 刚刚", tone: "blue" },
  { name: "梳理 Session 恢复边界", meta: "Queued · #2", tone: "amber" },
  { name: "修复 SSE 断线恢复", meta: "Completed · 18 分钟前", tone: "green" },
  { name: "审查 Workspace 授权", meta: "Available · 昨天", tone: "" },
  { name: "设计 Interrupted Run 提示", meta: "Available · 周一", tone: "" },
];

const icon = (name, className = "icon") => {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    folder: '<path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5Z"/><path d="M3 9h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.2"/>',
    send: '<path d="m4 5 17 7-17 7 3-7-3-7Z"/><path d="M7 12h14"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
    steer: '<path d="M4 12h11M11 7l5 5-5 5M19 5v14"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    tool: '<path d="M14 6a4 4 0 0 0-5 5L3.5 16.5a2.1 2.1 0 0 0 3 3L12 14a4 4 0 0 0 5-5l-2.5 2.5-2-2L15 7Z"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    arrowRight: '<path d="m9 18 6-6-6-6"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    chat: '<path d="M20 15a3 3 0 0 1-3 3H8l-4 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8Z"/>',
    pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  };
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ""}</svg>`;
};

const sessionRows = (compact = false) => `
  <ul class="session-list" aria-label="Sessions">
    ${sessions
      .map(
        (session, index) => `
      <li>
        <button class="session-row ${index === 0 ? "active" : ""}" data-session="${index}" type="button">
          <span class="session-name">${session.name}</span>
          <span class="dot ${session.tone}" aria-label="${session.meta.split(" · ")[0]}"></span>
          <span class="session-meta">${compact ? session.meta.split(" · ")[0] : session.meta}</span>
        </button>
      </li>`,
      )
      .join("")}
  </ul>`;

const workspaceCard = () => `
  <div class="workspace-card">
    <div class="workspace-line">
      <span class="workspace-glyph">${icon("folder", "icon-sm")}</span>
      <span style="min-width:0"><span class="workspace-title">no-pi-no-gang-v2</span><span class="workspace-path">G:\\AICode\\no-pi-no-gang-v2</span></span>
    </div>
  </div>`;

const sessionHeader = (mobileTarget = "nav") => `
  <header class="session-header">
    <button class="icon-button mobile-only" data-mobile-target="${mobileTarget}" type="button" aria-label="打开 Session 导航">${icon("menu")}</button>
    <div class="session-heading"><h1 data-session-title>重构 Gateway 契约</h1><p>Workspace / no-pi-no-gang-v2 · Session <span class="mono">01JZ…K8Q</span></p></div>
    <span class="spacer"></span>
    <span class="status running">Running</span>
    <button class="icon-button" type="button" aria-label="更多 Session 操作">${icon("more")}</button>
  </header>`;

const messages = (short = false) => `
  <div class="messages" data-messages>
    <article class="message">
      <div class="avatar user">你</div>
      <div><p class="message-meta"><span class="message-author">你</span><span class="message-time">10:42</span></p><div class="message-body"><p>检查 Gateway 契约边界，确保 Web 只依赖 browser-safe contracts，并给出最小改动方案。</p></div></div>
    </article>
    <article class="message">
      <div class="avatar">π</div>
      <div><p class="message-meta"><span class="message-author">Pi Agent</span><span class="message-time">10:42</span></p><div class="message-body">
        <p>我先定位 Web 与 Gateway 的交叉导入，再核对公共契约的导出面。</p>
        <div class="tool" data-tool>
          <button class="tool-button" type="button" aria-expanded="true">${icon("chevron", "icon-sm chevron")}${icon("tool", "icon-sm")}<span class="tool-title">read · packages/contracts/src/index.ts</span><span class="spacer"></span><span class="muted">完成</span></button>
          <div class="tool-result">导出 14 个 browser-safe schema<br />未发现 Node-only 类型泄漏</div>
        </div>
        ${
          short
            ? ""
            : `<pre class="code"><span class="pink">export type</span> { SessionSnapshot } <span class="pink">from</span> <span class="cyan">"./session.js"</span>;
<span class="pink">export</span> { runEventSchema } <span class="pink">from</span> <span class="cyan">"./run.js"</span>;</pre>`
        }
        <p>契约边界本身是清晰的；下一步只需移除 Web 对 Gateway 内部错误类型的直接引用，并映射为稳定 problem code。</p>
        <div class="run-line"><span class="spinner"></span><span>正在检查 3 个引用位置…</span><span class="spacer"></span><span class="mono">Run 8F2A</span></div>
      </div></div>
    </article>
  </div>`;

const composer = () => `
  <div class="composer-wrap">
    <form class="composer" data-composer>
      <label class="sr-only" for="prompt-${Math.random().toString(16).slice(2)}">向当前 Session 输入 Prompt 或 Steer</label>
      <textarea name="prompt" aria-label="向当前 Session 输入 Prompt 或 Steer" placeholder="向正在运行的 Run 发送 Steer…"></textarea>
      <div class="composer-actions">
        <span class="profile-chip">openai/gpt-5.6-sol</span><span class="profile-chip">thinking: medium</span>
        <span class="spacer"></span>
        <button class="danger-button" data-cancel type="button">${icon("stop", "icon-sm")}取消</button>
        <button class="soft-button" data-steer type="button">${icon("steer", "icon-sm")}Steer</button>
        <button class="send" type="submit" aria-label="发送 Steer">${icon("send", "icon-sm")}</button>
      </div>
    </form>
  </div>`;

const inspector = () => `
  <aside class="inspector" aria-label="Session 信息">
    <div class="tabs" role="tablist"><button class="tab active" role="tab" aria-selected="true">运行</button><button class="tab" role="tab" aria-selected="false">Session</button><button class="tab" role="tab" aria-selected="false">诊断</button></div>
    <section class="panel-section"><h2>Execution Profile</h2><dl class="key-values"><dt>Model</dt><dd>gpt-5.6-sol</dd><dt>Thinking</dt><dd>medium</dd><dt>Frozen at</dt><dd>10:42:08</dd></dl></section>
    <section class="panel-section"><h2>Run 队列</h2><div class="run-stack">
      <div class="run-card"><div class="run-card-head"><span class="dot blue"></span>Running <span class="spacer mono">8F2A</span></div><p>当前 Run · 已执行 1m 24s</p><div class="meter"><span></span></div></div>
      <div class="run-card"><div class="run-card-head"><span class="dot amber"></span>Queued <span class="spacer mono">91BC</span></div><p>队列位置 #1 · Execution Profile 已冻结</p></div>
    </div></section>
    <section class="panel-section"><h2>连接</h2><dl class="key-values"><dt>Gateway</dt><dd><span class="status">Online</span></dd><dt>Service</dt><dd>Ready</dd><dt>Epoch</dt><dd>e_01JZ…4TM</dd></dl></section>
    <section class="panel-section"><h2>Workspace Access</h2><p class="muted" style="font-size:11px;line-height:1.55;margin:0">已授权 canonical root。此授权不是操作系统沙箱。</p></section>
  </aside>`;

const variantA = () => `
  <main class="shell variant-a">
    <nav class="rail" data-mobile-panel="nav" aria-label="Workspace 与 Session 导航">
      <div class="rail-head"><div class="brand"><span class="brand-mark">π</span><span>no pi, no gang</span></div><span class="spacer"></span><button class="icon-button" aria-label="新建 Session">${icon("plus")}</button></div>
      ${workspaceCard()}
      <div class="rail-head"><p class="eyebrow">Sessions</p><span class="spacer"></span><button class="icon-button" aria-label="搜索 Session">${icon("search", "icon-sm")}</button></div>
      ${sessionRows()}
      <div class="rail-footer"><button class="icon-button" aria-label="设置">${icon("settings")}</button><span class="spacer"></span><span class="status">Online</span></div>
    </nav>
    <section class="transcript" aria-label="当前 Session 会话记录">${sessionHeader()}${messages()}${composer()}</section>
    ${inspector()}
  </main>`;

const variantB = () => `
  <main class="shell variant-b">
    <header class="topbar"><button class="icon-button mobile-only" data-mobile-target="nav" aria-label="打开 Session 导航">${icon("menu")}</button><div class="brand"><span class="brand-mark">π</span><span>no pi, no gang</span></div><span class="muted">/</span><strong style="font-size:12px">no-pi-no-gang-v2</strong><span class="spacer"></span><button class="soft-button">${icon("search", "icon-sm")}快速切换</button><span class="status">Online</span></header>
    <div class="b-body">
      <nav class="rail b-nav" data-mobile-panel="nav" aria-label="Session 导航">${workspaceCard()}<div class="rail-head"><p class="eyebrow">最近 Sessions</p><span class="spacer"></span><button class="icon-button" aria-label="新建 Session">${icon("plus")}</button></div>${sessionRows(true)}</nav>
      <section class="b-main">
        <div class="context-strip" aria-label="当前上下文">
          <div class="context-cell"><p class="eyebrow">当前 Session</p><div class="value" data-session-title>重构 Gateway 契约</div></div>
          <div class="context-cell"><p class="eyebrow">Run</p><div class="value"><span class="status running">Running · 8F2A</span></div></div>
          <div class="context-cell"><p class="eyebrow">Execution Profile</p><div class="value mono">gpt-5.6-sol · medium</div></div>
          <div class="context-cell"><p class="eyebrow">Workspace Access</p><div class="value">Authorized</div></div>
        </div>
        <div class="focus-stage">
          <section class="transcript" aria-label="当前 Session 会话记录">${sessionHeader("nav")}${messages()}${composer()}</section>
          <aside class="activity-timeline" aria-label="实时活动"><p class="eyebrow" style="margin-bottom:18px">实时活动</p>
            <div class="timeline-item"><strong>Run accepted</strong>Execution Profile 已冻结<br /><span class="mono">10:42:08</span></div>
            <div class="timeline-item"><strong>读取 contracts</strong>14 个 schema · 完成<br /><span class="mono">10:42:31</span></div>
            <div class="timeline-item"><strong>检查引用</strong>正在处理 2 / 3<br /><span class="mono">现在</span></div>
          </aside>
        </div>
      </section>
    </div>
  </main>`;

const boardCard = (title, state, text, tone = "", active = false) => `
  <button class="board-card ${active ? "active" : ""}" type="button" data-board-session="${title}"><h3>${title}</h3><p>${text}</p><span class="card-foot"><span class="dot ${tone}"></span><strong>${state}</strong><span class="spacer"></span><span class="mono">${state === "Running" ? "8F2A" : state === "Queued" ? "#2" : "18m"}</span></span></button>`;

const variantC = () => `
  <main class="shell variant-c">
    <nav class="c-dock" aria-label="主导航"><span class="brand-mark">π</span><button class="icon-button active" aria-label="运行画布">${icon("grid")}</button><button class="icon-button" aria-label="Sessions">${icon("chat")}</button><button class="icon-button" aria-label="诊断">${icon("pulse")}</button><span class="spacer"></span><button class="icon-button" aria-label="设置">${icon("settings")}</button><span class="dot green" aria-label="Online"></span></nav>
    <section class="c-board" data-mobile-panel="board">
      <header class="board-head"><div><p class="eyebrow">Workspace · no-pi-no-gang-v2</p><h1>Session 运行画布</h1><p>跨 Session 查看并发状态；同一 Session 仍按 FIFO 串行。</p></div><span class="spacer"></span><button class="primary-button">${icon("plus", "icon-sm")}新建 Session</button></header>
      <div class="summary-grid"><div class="summary-card"><p class="eyebrow">Active Runs</p><div class="number">2</div></div><div class="summary-card"><p class="eyebrow">Queued</p><div class="number">1</div></div><div class="summary-card"><p class="eyebrow">Gateway</p><div style="margin-top:12px"><span class="status">Online</span></div></div></div>
      <div class="board-columns">
        <section class="board-column"><div class="column-title"><span class="dot blue"></span>Running<span class="count">2</span></div>${boardCard("重构 Gateway 契约", "Running", "正在检查 browser-safe contracts 的引用边界。", "blue", true)}${boardCard("索引恢复验证", "Running", "从 Pi JSONL 重建 Session 查询索引。", "blue")}</section>
        <section class="board-column"><div class="column-title"><span class="dot amber"></span>Queued<span class="count">1</span></div>${boardCard("梳理 Session 恢复边界", "Queued", "等待当前 Session 的 active Run 完成。", "amber")}</section>
        <section class="board-column"><div class="column-title"><span class="dot green"></span>Recent<span class="count">2</span></div>${boardCard("修复 SSE 断线恢复", "Completed", "Snapshot 已替换临时实时状态。", "green")}${boardCard("Workspace 授权审查", "Completed", "Canonical root 与确认流程已核对。", "green")}</section>
      </div>
    </section>
    <section class="c-detail transcript" aria-label="选中 Session 详情">${sessionHeader("board")}${messages(true)}${composer()}</section>
  </main>`;

const app = document.querySelector("#app");
const showPrototypeControls = ["localhost", "127.0.0.1"].includes(location.hostname);
let current = new URLSearchParams(location.search).get("variant")?.toUpperCase() ?? "A";
if (!(current in variants)) current = "A";

function switcher() {
  return `<div class="prototype-note">Throwaway prototype · 不连接真实 Gateway</div><nav class="switcher" aria-label="原型变体切换"><button type="button" data-cycle="-1" aria-label="上一个变体">${icon("arrowLeft")}</button><span class="switcher-label"><strong>${current}</strong> — ${variants[current]}</span><button type="button" data-cycle="1" aria-label="下一个变体">${icon("arrowRight")}</button></nav>`;
}

function render() {
  const templates = { A: variantA, B: variantB, C: variantC };
  app.innerHTML = `${templates[current]()}${showPrototypeControls ? switcher() : ""}`;
  document.title = `${current} — ${variants[current]} · Workbench Prototype`;
}

function cycle(direction) {
  const keys = Object.keys(variants);
  const next = (keys.indexOf(current) + direction + keys.length) % keys.length;
  current = keys[next];
  const url = new URL(location.href);
  url.searchParams.set("variant", current);
  history.replaceState({}, "", url);
  render();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.cycle) cycle(Number(target.dataset.cycle));

  if (target.matches("[data-session]")) {
    document.querySelectorAll(".session-row").forEach((row) => row.classList.remove("active"));
    target.classList.add("active");
    const session = sessions[Number(target.dataset.session)];
    document.querySelectorAll("[data-session-title]").forEach((heading) => {
      heading.textContent = session.name;
    });
    document.querySelector("[data-mobile-panel]")?.classList.remove("mobile-open");
  }

  if (target.matches("[data-mobile-target]")) {
    document
      .querySelector(`[data-mobile-panel="${target.dataset.mobileTarget}"]`)
      ?.classList.toggle("mobile-open");
  }

  if (target.closest("[data-tool]")) {
    const tool = target.closest("[data-tool]");
    tool.classList.toggle("collapsed");
    target.setAttribute("aria-expanded", String(!tool.classList.contains("collapsed")));
  }

  if (target.matches("[data-cancel]")) {
    target.innerHTML = `${icon("stop", "icon-sm")}Cancelling`;
    target.disabled = true;
    document.querySelectorAll(".status.running").forEach((status) => {
      status.textContent = "Cancelling";
    });
  }

  if (target.matches("[data-steer]")) {
    const textarea = target.closest("form").querySelector("textarea");
    textarea.focus();
    textarea.placeholder = "输入对当前 running Run 的纠偏…";
  }

  if (target.matches("[data-board-session]")) {
    document.querySelectorAll(".board-card").forEach((card) => card.classList.remove("active"));
    target.classList.add("active");
    document.querySelectorAll("[data-session-title]").forEach((heading) => {
      heading.textContent = target.dataset.boardSession;
    });
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const textarea = event.target.querySelector("textarea");
  if (!textarea.value.trim()) return;
  const messagesElement = document.querySelector("[data-messages]");
  messagesElement.insertAdjacentHTML(
    "beforeend",
    `<article class="message"><div class="avatar user">你</div><div><p class="message-meta"><span class="message-author">Steer</span><span class="message-time">现在 · 本地预览</span></p><div class="message-body"><p>${textarea.value.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p></div></div></article>`,
  );
  textarea.value = "";
  messagesElement.scrollTop = messagesElement.scrollHeight;
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (event.target.matches("input, textarea, [contenteditable]")) return;
  cycle(event.key === "ArrowLeft" ? -1 : 1);
});

window.addEventListener("popstate", () => {
  const requested = new URLSearchParams(location.search).get("variant")?.toUpperCase();
  if (requested && requested in variants) {
    current = requested;
    render();
  }
});

render();
