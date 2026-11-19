void (() => {
  "use strict"

  const arch = (globalThis.__arch = globalThis.__arch || {})
  const view = document.getElementById("view")
  arch.view = view

  function bindCopyButtons(root) {
    for (const btn of root.querySelectorAll("[data-copy]")) {
      if (btn.dataset.copyBound) continue
      btn.dataset.copyBound = "true"
      btn.addEventListener("click", () => arch.copyText(btn.dataset.copy, btn))
    }
  }

  arch.bindCopyButtons = bindCopyButtons

  function renderOverview() {
    const {
      DATA,
      files,
      edges,
      byId,
      pkgs,
      pkgStats,
      healthSummary,
      splitName,
      esc,
      ICONS,
      buildOverviewSource,
      mountDiagram,
    } = arch
    const crossEdges = edges.filter((e) => byId.get(e.from).pkg !== byId.get(e.to).pkg).length
    const health = healthSummary()
    const layerViewsCount = Object.keys(DATA.layers).length
    const apiTotal = DATA.api.http.length + DATA.api.ws.commands.length + DATA.api.ws.events.length
    const healthHref = health.totalIssues ? `#dep/${esc(health.firstBadFocus)}` : "#dep/"
    const healthMain = health.totalIssues
      ? `<span class="status-badge" data-tone="bad">${ICONS.warn}<span>${health.totalIssues} 处异常</span></span>`
      : `<span class="status-badge" data-tone="ok">${ICONS.ok}<span>全部合规</span></span>`
    const healthSub = health.totalIssues
      ? `${health.totalCycles} 循环 · ${health.totalViolations} 越层`
      : `${layerViewsCount} 个分层视图 · 0 越层`

    view.insertAdjacentHTML(
      "beforeend",
      `
        <div class="view-head">
          <div>
            <h1>系统总览</h1>
            <p class="lead">自动扫描源码 import、分层约束、关键数据流与前后端通信契约；点击任意包进入下钻分析。</p>
          </div>
          <span class="meta num">生成于 ${esc(DATA.generatedAt)} · ${esc(DATA.commit)}</span>
        </div>
        <section class="panel-flush stats-strip" aria-label="架构关键指标">
          <a class="stat-cell" href="#dep/">
            <span class="stat-label">源码规模</span>
            <span class="stat-value">${files.length}</span>
            <span class="stat-sub">${pkgs.length} 个工作区包</span>
          </a>
          <a class="stat-cell" href="#dep/">
            <span class="stat-label">内部依赖</span>
            <span class="stat-value">${edges.length}</span>
            <span class="stat-sub">跨包 ${crossEdges} 条</span>
          </a>
          <a class="stat-cell" href="${healthHref}">
            <span class="stat-label">分层健康度</span>
            <span class="stat-value">${healthMain}</span>
            <span class="stat-sub">${healthSub}</span>
          </a>
          <a class="stat-cell" href="#api">
            <span class="stat-label">接口与数据流</span>
            <span class="stat-value">${apiTotal}</span>
            <span class="stat-sub">${DATA.api.http.length} HTTP · ${DATA.api.ws.commands.length}/${DATA.api.ws.events.length} WS · ${DATA.flows.length} 流</span>
          </a>
        </section>
      `,
    )

    mountDiagram(view, buildOverviewSource(), {
      title: "系统拓扑与运行时通道",
      legendHtml: "实线为源码 import（数字为条数），虚线为运行时通道；点击包节点可下钻查看。",
    })

    const pkgCards = pkgs
      .map((p) => {
        const st = pkgStats(p)
        const { prefix, main } = splitName(p)
        const subText = st.subLayers.length ? st.subLayers.join(" → ") : "单一模块包（无内部分层）"
        const issuePill = st.issues
          ? `<span class="status-badge" data-tone="bad">${st.issues} 异常</span>`
          : ""
        return `
          <a class="pkg-card" href="#dep/${esc(p)}">
            <div class="pkg-card-head">
              <span class="pkg-name">${prefix ? `<span class="faint">${esc(prefix)}</span>` : ""}${esc(main)}</span>
              <span class="view-head-meta">
                ${issuePill}
                <span class="status-badge" data-tone="neutral">${esc(st.topLayer)}</span>
              </span>
            </div>
            <div class="pkg-layers">${esc(subText)}</div>
            <div class="pkg-metrics">
              <span>${st.fileCount} 文件</span>
              <span>${st.dirCount} 模块</span>
              <span>↓ ${st.inPkgCount} 被用</span>
              <span>↑ ${st.outPkgCount} 依赖</span>
            </div>
          </a>
        `
      })
      .join("")

    view.insertAdjacentHTML(
      "beforeend",
      `
        <section class="section-block">
          <div class="section-head">
            <h2>工作区包 <span class="count-pill">${pkgs.length}</span></h2>
            <span class="meta">按包级分层自上而下排列</span>
          </div>
          <div class="pkg-grid">${pkgCards}</div>
        </section>
      `,
    )
  }

  let flowChannelFilter = "all"

  function renderFlows(selectedId) {
    const { DATA, esc, tail, depLink, ICONS, buildFlowSource, mountDiagram } = arch
    const allFlows = DATA.flows
    const counts = {
      all: allFlows.length,
      ws: allFlows.filter((f) => f.channel === "ws").length,
      http: allFlows.filter((f) => f.channel === "http").length,
    }
    const visibleFlows =
      flowChannelFilter === "all"
        ? allFlows
        : allFlows.filter((f) => f.channel === flowChannelFilter)
    const activeFlow =
      visibleFlows.find((f) => f.id === selectedId) ?? visibleFlows[0] ?? allFlows[0]
    const activeIdx = visibleFlows.findIndex((f) => f.id === activeFlow.id)
    const prevFlow = activeIdx > 0 ? visibleFlows[activeIdx - 1] : null
    const nextFlow =
      activeIdx >= 0 && activeIdx < visibleFlows.length - 1 ? visibleFlows[activeIdx + 1] : null
    const chipBtn = (key, label) =>
      `<button class="chip" type="button" data-channel="${key}" aria-pressed="${flowChannelFilter === key}">${label} <span class="num">${counts[key]}</span></button>`

    view.insertAdjacentHTML(
      "beforeend",
      `
        <div class="view-head">
          <div>
            <h1>核心数据流</h1>
            <p class="lead">关键业务链路的手写语义标注，每一步直接关联真实源码符号；在 pnpm check 中持续校验引用有效性。</p>
          </div>
          <div class="view-head-meta" role="group" aria-label="按通道筛选">
            ${chipBtn("all", "全部")}
            ${chipBtn("ws", "WS")}
            ${chipBtn("http", "HTTP")}
          </div>
        </div>
      `,
    )

    for (const btn of view.querySelectorAll("[data-channel]")) {
      btn.addEventListener("click", () => {
        flowChannelFilter = btn.dataset.channel
        view.replaceChildren()
        renderFlows(activeFlow.id)
      })
    }

    const railItems = visibleFlows
      .map(
        (f) => `
          <a class="flow-nav-item" href="#flows/${esc(f.id)}"${
            f.id === activeFlow.id ? ' aria-current="page"' : ""
          }>
            <span class="flow-nav-title">${esc(f.title)}</span>
            <span class="flow-nav-meta">
              <span class="status-badge" data-tone="${f.channel === "ws" ? "info" : "neutral"}">${esc(f.channel.toUpperCase())}</span>
              <span class="meta num">${f.steps.length}</span>
            </span>
          </a>
        `,
      )
      .join("")
    const shell = document.createElement("div")
    shell.className = "flows-shell"
    shell.innerHTML = `
      <aside class="flows-rail panel-flush" aria-label="数据流列表">
        <div class="flow-nav-list">${railItems}</div>
      </aside>
      <div class="flow-detail" id="flow-detail"></div>
    `
    view.append(shell)

    const detail = shell.querySelector("#flow-detail")
    const actors = [...new Set(activeFlow.steps.flatMap((s) => [s.from, s.to]))]
    detail.insertAdjacentHTML(
      "beforeend",
      `
        <section class="panel">
          <div class="flow-detail-head">
            <div class="rel-title">
              <h2>${esc(activeFlow.title)}</h2>
              <span class="status-badge" data-tone="${activeFlow.channel === "ws" ? "info" : "neutral"}">${esc(activeFlow.channel.toUpperCase())}</span>
              <span class="count-pill">${activeFlow.steps.length} 步</span>
            </div>
            <div class="actors-row">${actors.map((a) => `<span class="step-actor mono">${esc(a)}</span>`).join("")}</div>
          </div>
        </section>
      `,
    )

    mountDiagram(detail, buildFlowSource(activeFlow), {
      title: `${activeFlow.title} · 时序图`,
    })

    const stepsHtml = activeFlow.steps
      .map((s, i) => {
        const [path, symbol] = (s.ref ?? "").split("#")
        const refHtml = path
          ? `<div class="step-ref">${depLink(path, tail(path, ""))} ${
              symbol ? `<code class="faint">${esc(symbol)}</code>` : ""
            }<button class="btn-ghost btn-compact" type="button" data-copy="${esc(s.ref)}">${ICONS.copy}<span>复制 ref</span></button></div>`
          : ""
        return `
          <li class="step-row">
            <span class="step-no">${i + 1}</span>
            <div class="step-body">
              <div class="step-route">
                <span class="step-actor mono">${esc(s.from)}</span>
                <span class="arrow" aria-hidden="true">→</span>
                <span class="step-actor mono">${esc(s.to)}</span>
              </div>
              <p class="step-text">${esc(s.text)}</p>
              ${refHtml}
            </div>
          </li>
        `
      })
      .join("")

    detail.insertAdjacentHTML(
      "beforeend",
      `
        <section class="panel section-block">
          <h3>步骤拆解</h3>
          <ol class="steps-timeline">${stepsHtml}</ol>
          <div class="flow-pager">
            ${
              prevFlow
                ? `<a class="btn-soft" href="#flows/${esc(prevFlow.id)}">${ICONS.arrowLeft}<span>${esc(prevFlow.title)}</span></a>`
                : "<span></span>"
            }
            ${
              nextFlow
                ? `<a class="btn-soft" href="#flows/${esc(nextFlow.id)}"><span>${esc(nextFlow.title)}</span>${ICONS.arrowRight}</a>`
                : "<span></span>"
            }
          </div>
        </section>
      `,
    )
    bindCopyButtons(view)
  }

  function renderApi(initialQuery = "") {
    const { DATA, tail, depLink, formatRoutePath, esc, ICONS } = arch
    const allRoutes = DATA.api.http
    const methods = ["ALL", ...new Set(allRoutes.map((r) => r.method))]
    let query = initialQuery
    let activeMethod = "ALL"
    let grouped = true

    view.insertAdjacentHTML(
      "beforeend",
      `
        <div class="view-head">
          <div>
            <h1>通信接口</h1>
            <p class="lead">从 Gateway 路由与 @pig/protocol 联合类型自动扫描的 HTTP 端点与 WebSocket 契约。</p>
          </div>
          <span class="meta num">${allRoutes.length} HTTP · ${DATA.api.ws.commands.length} 命令 · ${DATA.api.ws.events.length} 事件</span>
        </div>
        <section class="panel">
          <div class="toolbar">
            <div class="input-box">
              <span class="input-icon">${ICONS.search}</span>
              <input class="filter-input" id="api-search" type="search" value="${esc(query)}" placeholder="搜索路径、处理文件、调用方或 WS 消息…" aria-label="过滤通信接口" />
            </div>
            <div class="view-head-meta" id="api-method-chips" role="group" aria-label="HTTP 方法筛选"></div>
            <button class="chip" id="api-group-toggle" type="button" aria-pressed="true">按模块分组</button>
          </div>
        </section>
        <section class="section-block">
          <div class="section-head">
            <h2>HTTP 端点 <span class="count-pill" id="api-http-count"></span></h2>
          </div>
          <div class="panel-flush">
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>方法</th>
                    <th>路径</th>
                    <th>处理文件</th>
                    <th>Web 调用方</th>
                  </tr>
                </thead>
                <tbody id="api-http-body"></tbody>
              </table>
            </div>
          </div>
        </section>
        <section class="section-block">
          <div class="section-head">
            <div class="rel-title">
              <h2>WebSocket 契约</h2>
              <span class="status-badge mono" data-tone="info">${esc(DATA.api.ws.path)}</span>
            </div>
            <div class="view-head-meta">
              ${depLink("packages/gateway/src/server/websocket.ts", "server/websocket.ts")}
              ${depLink("packages/protocol/src/wire.ts", "protocol/wire.ts")}
            </div>
          </div>
          <div class="cols">
            <section class="rel-panel">
              <div class="rel-head">
                <div class="rel-title">
                  <span class="swatch" data-state="up"></span>
                  <h3>↑ 客户端命令</h3>
                  <span class="count-pill" id="api-cmd-count"></span>
                </div>
              </div>
              <ul class="ws-list" id="api-cmd-list"></ul>
            </section>
            <section class="rel-panel">
              <div class="rel-head">
                <div class="rel-title">
                  <span class="swatch" data-state="down"></span>
                  <h3>↓ 服务端事件</h3>
                  <span class="count-pill" id="api-evt-count"></span>
                </div>
              </div>
              <ul class="ws-list" id="api-evt-list"></ul>
            </section>
          </div>
        </section>
      `,
    )

    const searchInput = view.querySelector("#api-search")
    const chipsBox = view.querySelector("#api-method-chips")
    const groupBtn = view.querySelector("#api-group-toggle")
    const httpCount = view.querySelector("#api-http-count")
    const httpBody = view.querySelector("#api-http-body")
    const cmdCount = view.querySelector("#api-cmd-count")
    const evtCount = view.querySelector("#api-evt-count")
    const cmdList = view.querySelector("#api-cmd-list")
    const evtList = view.querySelector("#api-evt-list")
    const draw = () => {
      const q = query.trim().toLowerCase()
      const qMatched = q
        ? allRoutes.filter((r) =>
            `${r.method} ${r.path} ${r.handler} ${r.callers.join(" ")}`.toLowerCase().includes(q),
          )
        : allRoutes

      chipsBox.innerHTML = methods
        .map((m) => {
          const cnt = m === "ALL" ? qMatched.length : qMatched.filter((r) => r.method === m).length
          return `<button class="chip" type="button" data-method="${esc(m)}" aria-pressed="${activeMethod === m}">${m === "ALL" ? "全部" : esc(m)} <span class="num">${cnt}</span></button>`
        })
        .join("")

      for (const btn of chipsBox.querySelectorAll("[data-method]")) {
        btn.addEventListener("click", () => {
          activeMethod = btn.dataset.method
          draw()
        })
      }

      const rows =
        activeMethod === "ALL" ? qMatched : qMatched.filter((r) => r.method === activeMethod)

      httpCount.textContent =
        rows.length === allRoutes.length
          ? String(allRoutes.length)
          : `${rows.length} / ${allRoutes.length}`

      if (!rows.length) {
        httpBody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p class="lead">没有符合当前筛选条件的 HTTP 端点</p><button class="btn-soft" id="api-clear" type="button">清除筛选</button></div></td></tr>`
        httpBody.querySelector("#api-clear")?.addEventListener("click", () => {
          query = ""
          activeMethod = "ALL"
          searchInput.value = ""
          draw()
          searchInput.focus()
        })
      } else {
        const routeRow = (r) => `
          <tr>
            <td><span class="method-badge" data-method="${esc(r.method)}">${esc(r.method)}</span></td>
            <td>
              <div class="route-cell">
                <span class="route-path">${formatRoutePath(r.path)}</span>
                <button class="icon-btn" type="button" data-copy="${esc(r.path)}" data-copy-icon-only="true" aria-label="复制路径 ${esc(r.path)}" title="复制路径">${ICONS.copy}</button>
              </div>
            </td>
            <td>${depLink(r.handler, tail(r.handler, "packages/gateway/src"))}</td>
            <td>${r.callers.map((c) => depLink(c, tail(c, "apps/web/src"))).join("<br/>") || '<span class="hint">无直接调用方</span>'}</td>
          </tr>
        `

        if (grouped) {
          const groups = Map.groupBy(rows, (r) => tail(r.handler, "packages/gateway/src"))
          httpBody.innerHTML = [...groups]
            .map(
              ([handler, list]) =>
                `<tr class="group-banner-row"><td colspan="4" class="mono">${esc(handler)} · ${list.length} 条</td></tr>${list.map(routeRow).join("")}`,
            )
            .join("")
        } else {
          httpBody.innerHTML = rows.map(routeRow).join("")
        }
      }

      const cmds = q
        ? DATA.api.ws.commands.filter((x) => x.toLowerCase().includes(q))
        : DATA.api.ws.commands
      const evts = q
        ? DATA.api.ws.events.filter((x) => x.toLowerCase().includes(q))
        : DATA.api.ws.events

      cmdCount.textContent = String(cmds.length)
      evtCount.textContent = String(evts.length)

      const renderWsItems = (items) =>
        items.length
          ? items
              .map(
                (x) =>
                  `<li class="ws-item"><code>${esc(x)}</code><button class="icon-btn" type="button" data-copy="${esc(x)}" data-copy-icon-only="true" aria-label="复制 ${esc(x)}" title="复制">${ICONS.copy}</button></li>`,
              )
              .join("")
          : '<li class="ws-item"><span class="hint">无匹配项</span></li>'

      cmdList.innerHTML = renderWsItems(cmds)
      evtList.innerHTML = renderWsItems(evts)
      bindCopyButtons(view)
    }

    searchInput.addEventListener("input", () => {
      query = searchInput.value
      draw()
    })
    groupBtn.addEventListener("click", () => {
      grouped = !grouped
      groupBtn.setAttribute("aria-pressed", String(grouped))
      draw()
    })
    draw()
  }

  arch.initTheme()
  const previewCtrl = arch.initPreview()
  const searchCtrl = arch.initSearch()
  const commitEl = document.getElementById("meta-commit")
  commitEl.textContent = `${arch.DATA.commit} · ${arch.files.length} 文件`
  commitEl.title = `生成于 ${arch.DATA.generatedAt}`

  function route(moveFocus = false) {
    const raw = decodeURIComponent(location.hash.slice(1)) || "overview"
    const qAt = raw.indexOf("?")
    const path = qAt >= 0 ? raw.slice(0, qAt) : raw
    const params = new URLSearchParams(qAt >= 0 ? raw.slice(qAt + 1) : "")
    const tab = path.startsWith("dep/")
      ? "#dep/"
      : path.startsWith("flows")
        ? "#flows"
        : path === "api"
          ? "#api"
          : "#overview"

    for (const a of document.querySelectorAll(".main-nav a")) {
      if (a.getAttribute("href") === tab) a.setAttribute("aria-current", "page")
      else a.removeAttribute("aria-current")
    }

    previewCtrl.closeIfOpen()
    searchCtrl.closeIfOpen()
    view.replaceChildren()

    if (path.startsWith("dep/")) {
      const target = path.slice(4)
      arch.renderDeps(target)
      document.title = target ? `依赖 · ${target} — pig 架构看板` : "依赖分层 — pig 架构看板"
      arch.announce(`已切换到依赖视图 ${target || "全部包"}`)
    } else if (path === "flows" || path.startsWith("flows/")) {
      const flowId = path.startsWith("flows/") ? path.slice(6) : ""
      renderFlows(flowId)
      document.title = "核心数据流 — pig 架构看板"
      arch.announce("已切换到核心数据流")
    } else if (path === "api") {
      renderApi(params.get("q") ?? "")
      document.title = "通信接口 — pig 架构看板"
      arch.announce("已切换到通信接口")
    } else {
      renderOverview()
      document.title = "pig 架构看板"
      arch.announce("已切换到系统总览")
    }

    if (moveFocus) view.focus({ preventScroll: true })
    scrollTo(0, 0)
  }

  addEventListener("hashchange", () => route(true))
  route(false)
})()
