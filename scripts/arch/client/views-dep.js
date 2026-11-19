void (() => {
  "use strict"

  const arch = (globalThis.__arch = globalThis.__arch || {})

  function renderScopeBar(activePkg) {
    const { DATA, pkgs, esc, healthSummary } = arch
    const { issuesByFocus } = healthSummary()
    const pill = (href, label, current, issues) => {
      const warn = issues ? ` <span class="status-badge" data-tone="bad">${issues}</span>` : ""
      return `<a class="scope-pill" href="${href}" aria-current="${current ? "true" : "false"}">${esc(label)}${warn}</a>`
    }

    return `<div class="scope-bar" role="navigation" aria-label="工作区范围">${pill(
      "#dep/",
      "全部包",
      activePkg === "",
      issuesByFocus.get("") ?? 0,
    )}${pkgs
      .map((p) => {
        const layers = DATA.layers[p]
        const issues = layers ? layers.cycles.length + layers.violations.length : 0
        return pill(`#dep/${esc(p)}`, p, activePkg === p, issues)
      })
      .join("")}</div>`
  }

  function renderCrumbs(path, showCopy) {
    const { byId, dirPkg, pkgOf, short, tail, esc, ICONS } = arch
    const file = byId.get(path)
    const pkg = file?.pkg ?? (path ? pkgOf(path) : undefined)
    const dir = file?.dir ?? (dirPkg.has(path) ? path : undefined)
    const parts = [["", "全部"]]

    if (pkg) parts.push([pkg, pkg])

    if (dir && dir !== pkg) parts.push([dir, short(dir, pkg)])

    if (file) parts.push([file.id, tail(file.id, file.dir)])

    const items = parts.map(([id, text], i) =>
      i === parts.length - 1
        ? `<span aria-current="page">${esc(text)}</span>`
        : `<a href="#dep/${esc(id)}">${esc(text)}</a>`,
    )
    const copyBtn =
      showCopy && path
        ? `<button class="btn-soft btn-compact" type="button" data-copy="${esc(path)}">${ICONS.copy}<span>复制路径</span></button>`
        : ""
    return `<div class="crumbs-bar"><div class="crumbs">${items.join("")}</div>${copyBtn}</div>`
  }

  function renderPairsGroupList(map, focus, isPkgLevel) {
    const { byId, short, fileNameHtml, esc, ICONS } = arch

    if (!map.size) return '<div class="panel"><p class="hint">无</p></div>'
    const entries = [...map].sort((a, b) => b[1].length - a[1].length)
    const autoOpenFirst = entries.length <= 2
    return entries
      .map(([k, list], idx) => {
        const label = focus ? short(k, focus) : k
        const pairs = list
          .map(
            (e) =>
              `<li class="pair-item"><a href="#dep/${esc(e.from)}">${fileNameHtml(e.from, byId.get(e.from).dir)}</a><span class="arrow">→</span><a href="#dep/${esc(e.to)}">${fileNameHtml(e.to, byId.get(e.to).dir)}</a></li>`,
          )
          .join("")
        const jumpText = isPkgLevel ? `进入 ${label}` : `查看 ${label}`
        return `
          <details class="rel-group"${autoOpenFirst && idx === 0 ? " open" : ""}>
            <summary class="rel-summary">
              ${ICONS.chevron}
              <span class="rel-summary-main mono">${esc(label)}</span>
              <span class="rel-summary-end"><span class="count-pill">${list.length}</span></span>
            </summary>
            <ul class="pair-list">
              <li><a class="rel-jump" href="#dep/${esc(k)}">${esc(jumpText)} →</a></li>
              ${pairs}
            </ul>
          </details>
        `
      })
      .join("")
  }

  function renderRelColumn({ state, title, map, focus, isPkgLevel = false }) {
    const hasGroups = map.size > 0
    const toggleBtn = hasGroups
      ? '<button class="btn-ghost btn-compact rel-toggle" type="button" data-expanded="false">全部展开</button>'
      : ""
    return `
      <section class="rel-panel">
        <div class="rel-head">
          <div class="rel-title">
            <span class="swatch" data-state="${state}"></span>
            <h2>${title}</h2>
            <span class="count-pill">${map.size}</span>
          </div>
          ${toggleBtn}
        </div>
        <div class="rel-body">${renderPairsGroupList(map, focus, isPkgLevel)}</div>
      </section>
    `
  }

  function wireRelPanels(root) {
    for (const panel of root.querySelectorAll(".rel-panel")) {
      const btn = panel.querySelector(".rel-toggle")
      const groups = [...panel.querySelectorAll("details.rel-group")]

      if (!btn || !groups.length) continue

      const syncLabel = () => {
        const allOpen = groups.every((g) => g.open)
        btn.dataset.expanded = String(allOpen)
        btn.textContent = allOpen ? "全部收起" : "全部展开"
      }

      syncLabel()
      btn.addEventListener("click", () => {
        const next = btn.dataset.expanded !== "true"

        for (const g of groups) g.open = next
        syncLabel()
      })

      for (const g of groups) g.addEventListener("toggle", syncLabel)
    }
  }

  function renderFileTableSection(parent, own, dir) {
    const { importers, imports, fileNameHtml, esc, ICONS } = arch
    const rows = own.map((f) => ({
      id: f.id,
      name: f.id,
      into: importers.get(f.id)?.length ?? 0,
      out: imports.get(f.id)?.length ?? 0,
    }))
    const maxInto = Math.max(1, ...rows.map((r) => r.into))
    const section = document.createElement("section")
    section.className = "panel-flush"
    section.innerHTML = `
      <div class="table-toolbar">
        <div class="rel-title">
          <h2>文件清单</h2>
          <span class="count-pill" id="file-table-count">${rows.length}</span>
        </div>
        <div class="input-box">
          <span class="input-icon">${ICONS.search}</span>
          <input class="filter-input" id="file-filter" type="search" placeholder="筛选当前模块文件…" aria-label="筛选当前模块文件" />
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th aria-sort="none"><button class="sort-btn" type="button" data-sort="name">文件</button></th>
              <th class="num-col" aria-sort="descending"><button class="sort-btn" type="button" data-sort="into" data-active="true">被引用 ↓</button></th>
              <th class="num-col" aria-sort="none"><button class="sort-btn" type="button" data-sort="out">引用</button></th>
            </tr>
          </thead>
          <tbody id="file-table-body"></tbody>
        </table>
      </div>
    `
    parent.append(section)
    const tbody = section.querySelector("#file-table-body")
    const filterInput = section.querySelector("#file-filter")
    const countEl = section.querySelector("#file-table-count")
    const headers = [...section.querySelectorAll("thead th")]
    let sortKey = "into"
    let sortDir = -1
    let query = ""
    const draw = () => {
      const q = query.trim().toLowerCase()
      const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows]
      filtered.sort((a, b) => {
        if (sortKey === "name") return sortDir * a.name.localeCompare(b.name)
        return sortDir * (a[sortKey] - b[sortKey]) || a.name.localeCompare(b.name)
      })
      countEl.textContent = q ? `${filtered.length} / ${rows.length}` : String(rows.length)

      for (const th of headers) {
        const btn = th.querySelector(".sort-btn")
        const key = btn.dataset.sort
        const active = key === sortKey
        btn.dataset.active = String(active)
        th.setAttribute("aria-sort", active ? (sortDir > 0 ? "ascending" : "descending") : "none")
        const base = key === "name" ? "文件" : key === "into" ? "被引用" : "引用"
        btn.textContent = active ? `${base} ${sortDir > 0 ? "↑" : "↓"}` : base
      }

      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><p class="lead">没有匹配 “${esc(query)}” 的文件</p><button class="btn-soft" id="clear-file-filter" type="button">清除筛选</button></div></td></tr>`
        tbody.querySelector("#clear-file-filter")?.addEventListener("click", () => {
          query = ""
          filterInput.value = ""
          draw()
          filterInput.focus()
        })
        return
      }

      tbody.innerHTML = filtered
        .map((r) => {
          const pct = r.into ? Math.max(8, Math.round((r.into / maxInto) * 100)) : 0
          return `
            <tr>
              <td><a href="#dep/${esc(r.id)}">${fileNameHtml(r.id, dir)}</a></td>
              <td class="num-col${r.into ? "" : " num-zero"}">
                <span class="num-cell">
                  <span class="mini-meter" aria-hidden="true"><span class="mini-meter-fill" style="inline-size:${pct}%"></span></span>
                  <span>${r.into}</span>
                </span>
              </td>
              <td class="num-col${r.out ? "" : " num-zero"}">${r.out}</td>
            </tr>
          `
        })
        .join("")
    }

    for (const th of headers) {
      const btn = th.querySelector(".sort-btn")
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort

        if (sortKey === key) sortDir *= -1
        else {
          sortKey = key
          sortDir = key === "name" ? 1 : -1
        }

        draw()
      })
    }

    filterInput.addEventListener("input", () => {
      query = filterInput.value
      draw()
    })
    draw()
  }

  function renderMap(focus, sel) {
    const { DATA, files, pairsOf, pkgStats, short, splitName, esc, ICONS, view, bindCopyButtons } =
      arch
    const { bands, cycles, violations } = DATA.layers[focus]
    const pairs = pairsOf(focus)
    const users = new Map()
    const uses = new Map()

    for (const [key, list] of pairs) {
      const [a, b] = key.split("\n")

      if (b === sel) users.set(a, list)

      if (a === sel) uses.set(b, list)
    }

    const bad = new Set([...cycles.flat(), ...violations.flatMap((v) => [v.from, v.to])])
    const name = (k) => short(k, focus)
    const countMap = new Map()

    for (const f of files) {
      const k = focus ? f.dir : f.pkg
      countMap.set(k, (countMap.get(k) ?? 0) + 1)
    }

    const tile = (k) => {
      const state = k === sel ? "me" : users.has(k) ? "up" : uses.has(k) ? "down" : sel ? "dim" : ""
      const isBad = bad.has(k)
      const { prefix, main } = splitName(name(k))
      const badgeText = users.has(k)
        ? `← ${users.get(k).length}`
        : uses.has(k)
          ? `→ ${uses.get(k).length}`
          : `${countMap.get(k) ?? 0}`
      const href = k === sel ? `#dep/${focus}` : `#dep/${k}`
      return `<a class="tile" href="${esc(href)}" data-key="${esc(k)}" data-state="${state}"${
        isBad ? ' data-bad="true"' : ""
      }>${prefix ? `<span class="tile-prefix">${esc(prefix)}</span>` : ""}<span>${esc(main)}</span><span class="tile-badge">${esc(badgeText)}</span>${
        isBad ? '<span class="tile-bad-mark" title="存在循环引用或跨层依赖">!</span>' : ""
      }</a>`
    }
    const rows = bands
      .map(
        (b, i) => `
          <div class="band-row">
            <div class="band-head">
              <div class="band-title-row">
                <span class="band-index">L${i + 1}</span>
                <span class="band-name">${esc(b.name)}</span>
              </div>
              <span class="band-note">${esc(b.note)}</span>
            </div>
            <div class="tiles">${b.keys.map(tile).join("")}</div>
          </div>
        `,
      )
      .join("")
    const swatchItem = (state, text) =>
      `<span class="legend-item"><span class="swatch" data-state="${state}"></span><span>${text}</span></span>`
    const legendItems = sel
      ? [
          swatchItem("me", "当前选中"),
          swatchItem("up", "谁用它（上游）"),
          swatchItem("down", "它用谁（下游）"),
          ...(bad.size ? [swatchItem("bad", "越层 / 循环")] : []),
        ]
      : bad.size
        ? [swatchItem("bad", "存在循环引用或下层引用上层")]
        : []
    const headingTitle = sel ? name(sel) : focus || "工作区包分层"
    const headingLead = focus
      ? "自上而下按依赖层级排列；点击任意模块锁定查看上下游关系，再点一次取消。"
      : "自上而下按包层级排列；悬停可预览依赖关系，点击进入包内模块视图。"

    view.insertAdjacentHTML(
      "beforeend",
      `<div class="view-head"><div><h1>${esc(headingTitle)}</h1><p class="lead">${headingLead}</p></div></div>`,
    )
    view.insertAdjacentHTML("beforeend", renderScopeBar(focus))

    if (sel || focus) view.insertAdjacentHTML("beforeend", renderCrumbs(sel ?? focus, Boolean(sel)))

    const matrix = document.createElement("section")
    matrix.className = "panel-flush"
    matrix.innerHTML = `
      <div class="layer-matrix-head">
        <div class="legend">${
          legendItems.length
            ? legendItems.join("")
            : '<span class="hint">依赖方向应严格自上而下，下层不得引用上层</span>'
        }</div>
        ${sel ? `<a class="btn-soft btn-compact" href="#dep/${esc(focus)}">取消选中</a>` : ""}
      </div>
      <div class="bands">${rows}</div>
    `
    view.append(matrix)

    if (!sel && matchMedia("(hover: hover)").matches) {
      const tileEls = [...matrix.querySelectorAll(".tile")]

      for (const el of tileEls) {
        el.addEventListener("mouseenter", () => {
          const hovered = el.dataset.key
          const relUp = new Set()
          const relDown = new Set()

          for (const key of pairs.keys()) {
            const [a, b] = key.split("\n")

            if (b === hovered) relUp.add(a)

            if (a === hovered) relDown.add(b)
          }

          for (const item of tileEls) {
            const k = item.dataset.key
            item.dataset.preview =
              k === hovered ? "me" : relUp.has(k) ? "up" : relDown.has(k) ? "down" : "dim"
          }
        })
        el.addEventListener("mouseleave", () => {
          for (const item of tileEls) delete item.dataset.preview
        })
      }
    }

    if (cycles.length || violations.length) {
      const problems = [
        cycles.length &&
          `<div><strong>${cycles.length} 处循环引用</strong>：${cycles.map((c) => `<span class="mono">${c.map((k) => esc(name(k))).join(" ⇄ ")}</span>`).join("；")}</div>`,
        violations.length &&
          `<div><strong>${violations.length} 处下层引用上层</strong>：${violations.map((v) => `<span class="mono">${esc(name(v.from))} → ${esc(name(v.to))}</span>（${v.count} 处）`).join("；")}</div>`,
      ].filter(Boolean)

      view.insertAdjacentHTML("beforeend", `<div class="problem-banner">${problems.join("")}</div>`)
    }

    if (sel) {
      const layerMap = new Map(
        bands.flatMap((b, i) => b.keys.map((k) => [k, { idx: i + 1, name: b.name }])),
      )
      const layerInfo = layerMap.get(sel)
      const belowCount = [...users.keys()].filter((k) => layerMap.get(k).idx > layerInfo.idx).length
      const own = files.filter((f) => f.dir === sel)
      const isOk = !bad.has(sel) && belowCount === 0
      view.insertAdjacentHTML(
        "beforeend",
        `
          <section class="panel summary-bar">
            <div class="summary-main">
              <span class="status-badge" data-tone="neutral">L${layerInfo.idx} · ${esc(layerInfo.name)}</span>
              <span class="status-badge" data-tone="${isOk ? "ok" : "bad"}">${isOk ? ICONS.ok : ICONS.warn}<span>${isOk ? "分层合规" : `存在 ${belowCount} 处越层或循环`}</span></span>
              <span class="meta num">${own.length} 文件 · ${users.size} 个上游模块 · ${uses.size} 个下游模块</span>
            </div>
            <div class="summary-actions">
              <button class="btn-soft btn-compact" type="button" data-copy="${esc(sel)}">${ICONS.copy}<span>复制模块路径</span></button>
              <a class="btn-soft btn-compact" href="#dep/${esc(focus)}">取消选中</a>
            </div>
          </section>
        `,
      )
      const cols = document.createElement("div")
      cols.className = "cols"
      cols.innerHTML =
        renderRelColumn({ state: "up", title: "谁用它（上游）", map: users, focus }) +
        renderRelColumn({ state: "down", title: "它用谁（下游）", map: uses, focus })
      view.append(cols)
      wireRelPanels(cols)
      renderFileTableSection(view, own, sel)
    } else if (!focus) {
      const crossList = [...pairs]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, list]) => {
          const [fromPkg, toPkg] = key.split("\n")
          return `
            <details class="rel-group">
              <summary class="rel-summary">
                ${ICONS.chevron}
                <span class="rel-summary-main mono">${esc(fromPkg)} → ${esc(toPkg)}</span>
                <span class="rel-summary-end"><span class="count-pill">${list.length}</span></span>
              </summary>
              <ul class="pair-list">${list
                .map(
                  (e) =>
                    `<li class="pair-item"><a href="#dep/${esc(e.from)}">${esc(e.from)}</a><span class="arrow">→</span><a href="#dep/${esc(e.to)}">${esc(e.to)}</a></li>`,
                )
                .join("")}</ul>
            </details>
          `
        })
        .join("")
      const crossPanel = document.createElement("section")
      crossPanel.className = "rel-panel"
      crossPanel.innerHTML = `
        <div class="rel-head">
          <div class="rel-title">
            <h2>跨包引用明细</h2>
            <span class="count-pill">${pairs.size}</span>
          </div>
          <button class="btn-ghost btn-compact rel-toggle" type="button" data-expanded="false">全部展开</button>
        </div>
        <div class="rel-body">${crossList}</div>
      `
      view.append(crossPanel)
      wireRelPanels(crossPanel)
    } else {
      const stats = pkgStats(focus)
      const pkgOwn = files.filter((f) => f.pkg === focus)
      renderFileTableSection(view, pkgOwn, `${focus}/src`)
      view.insertAdjacentHTML(
        "beforeend",
        `<p class="hint">包内共 ${stats.dirCount} 个模块、${stats.fileCount} 个文件，跨包被 ${stats.inPkgCount} 个包引用、引用 ${stats.outPkgCount} 个包。</p>`,
      )
    }

    bindCopyButtons(view)
  }

  function renderSinglePackage(pkg) {
    const { pkgFiles, crossPkgPairs, esc, ICONS, view, bindCopyButtons } = arch
    const own = pkgFiles.get(pkg) ?? []
    const cross = crossPkgPairs(pkg)
    view.insertAdjacentHTML(
      "beforeend",
      `<div class="view-head"><div><h1>${esc(pkg)}</h1><p class="lead">单一模块工作区包，展示其与其他包之间的跨包依赖及内部文件。</p></div></div>`,
    )
    view.insertAdjacentHTML("beforeend", renderScopeBar(pkg))
    view.insertAdjacentHTML("beforeend", renderCrumbs(pkg, true))
    view.insertAdjacentHTML(
      "beforeend",
      `
        <section class="panel summary-bar">
          <div class="summary-main">
            <span class="status-badge" data-tone="neutral">单层模块包</span>
            <span class="meta num">${own.length} 文件 · 被 ${cross.users.size} 个包引用（${cross.inEdges} 处）· 引用 ${cross.uses.size} 个包（${cross.outEdges} 处）</span>
          </div>
          <button class="btn-soft btn-compact" type="button" data-copy="${esc(pkg)}">${ICONS.copy}<span>复制包路径</span></button>
        </section>
      `,
    )
    const cols = document.createElement("div")
    cols.className = "cols"
    cols.innerHTML =
      renderRelColumn({
        state: "up",
        title: "谁用它（跨包）",
        map: cross.users,
        focus: "",
        isPkgLevel: true,
      }) +
      renderRelColumn({
        state: "down",
        title: "它用谁（跨包）",
        map: cross.uses,
        focus: "",
        isPkgLevel: true,
      })
    view.append(cols)
    wireRelPanels(cols)
    renderFileTableSection(view, own, `${pkg}/src`)
    bindCopyButtons(view)
  }

  function renderGroupedFiles(ids, openFirst) {
    const { byId, dirPkg, short, fileNameHtml, esc, ICONS } = arch

    if (!ids.length) return '<div class="panel"><p class="hint">无</p></div>'
    const groups = Map.groupBy(ids, (id) => byId.get(id).dir)
    return [...groups]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([dir, list], idx) => {
        const pkg = dirPkg.get(dir)
        const items = [...list]
          .sort()
          .map((id) => `<li><a href="#dep/${esc(id)}">${fileNameHtml(id, dir)}</a></li>`)
          .join("")
        return `
          <details class="rel-group"${openFirst && idx === 0 ? " open" : ""}>
            <summary class="rel-summary">
              ${ICONS.chevron}
              <span class="rel-summary-main mono"><span class="faint">${esc(pkg)}/</span>${esc(short(dir, pkg))}</span>
              <span class="rel-summary-end"><span class="count-pill">${list.length}</span></span>
            </summary>
            <ul class="file-list">${items}</ul>
          </details>
        `
      })
      .join("")
  }

  function renderFile(path) {
    const {
      byId,
      files,
      importers,
      imports,
      impactLayers,
      tail,
      short,
      esc,
      ICONS,
      view,
      bindCopyButtons,
    } = arch
    const file = byId.get(path)
    const layers = impactLayers(path)
    const directIn = importers.get(path) ?? []
    const directOut = imports.get(path) ?? []
    const totalImpact = layers.reduce((n, l) => n + l.length, 0)
    const maxWave = Math.max(1, ...layers.map((l) => l.length))
    view.insertAdjacentHTML(
      "beforeend",
      `
        <div class="view-head">
          <div>
            <h1 class="mono">${esc(tail(path, file.dir))}</h1>
            <p class="lead mono">${esc(path)}</p>
          </div>
          <div class="view-head-meta">
            <button class="btn-soft" type="button" data-copy="${esc(path)}">${ICONS.copy}<span>复制路径</span></button>
            <a class="btn-soft" href="#dep/${esc(file.dir)}">返回 ${esc(short(file.dir, file.pkg))}</a>
          </div>
        </div>
      `,
    )
    view.insertAdjacentHTML("beforeend", renderScopeBar(file.pkg))
    view.insertAdjacentHTML("beforeend", renderCrumbs(path, false))
    view.insertAdjacentHTML(
      "beforeend",
      `
        <section class="panel-flush stats-strip">
          <div class="stat-cell"><span class="stat-label">直接被引用</span><span class="stat-value">${directIn.length}</span><span class="stat-sub">L1 扇入</span></div>
          <div class="stat-cell"><span class="stat-label">总波及文件</span><span class="stat-value">${totalImpact}</span><span class="stat-sub">占全仓 ${Math.round((totalImpact / files.length) * 100)}%</span></div>
          <div class="stat-cell"><span class="stat-label">传导深度</span><span class="stat-value">${layers.length}</span><span class="stat-sub">层反向传播</span></div>
          <div class="stat-cell"><span class="stat-label">直接引用</span><span class="stat-value">${directOut.length}</span><span class="stat-sub">出边数量</span></div>
        </section>
      `,
    )

    const impactHtml = layers.length
      ? layers
          .map((l, i) => {
            const pct = Math.max(6, Math.round((l.length / maxWave) * 100))
            return `
              <div class="wave-block">
                <div class="wave-head">
                  <span class="wave-title"><span>${i ? `L${i + 1} 间接波及` : "L1 直接引用"}</span><span class="count-pill">${l.length}</span></span>
                  <span class="wave-bar" aria-hidden="true"><span class="wave-bar-fill" style="inline-size:${pct}%"></span></span>
                </div>
                ${renderGroupedFiles(l, i === 0 && l.length <= 12)}
              </div>
            `
          })
          .join("")
      : '<div class="panel"><p class="hint">没有仓库内文件引用此文件</p></div>'
    const cols = document.createElement("div")
    cols.className = "cols"
    cols.innerHTML = `
      <section class="rel-panel">
        <div class="rel-head">
          <div class="rel-title">
            <span class="swatch" data-state="up"></span>
            <h2>谁引用它</h2>
            <span class="count-pill">波及 ${totalImpact}</span>
          </div>
          ${totalImpact ? '<button class="btn-ghost btn-compact rel-toggle" type="button" data-expanded="false">全部展开</button>' : ""}
        </div>
        <div class="rel-body">${impactHtml}</div>
      </section>
      <section class="rel-panel">
        <div class="rel-head">
          <div class="rel-title">
            <span class="swatch" data-state="down"></span>
            <h2>它引用谁</h2>
            <span class="count-pill">${directOut.length}</span>
          </div>
          ${directOut.length ? '<button class="btn-ghost btn-compact rel-toggle" type="button" data-expanded="false">全部展开</button>' : ""}
        </div>
        <div class="rel-body">${renderGroupedFiles(directOut, directOut.length <= 12)}</div>
      </section>
    `
    view.append(cols)
    wireRelPanels(cols)
    bindCopyButtons(view)
  }

  function renderDeps(path) {
    const { DATA, byId, dirPkg, pkgOf } = arch

    if (byId.has(path)) return renderFile(path)
    const pkg = path ? pkgOf(path) : ""

    if (pkg && !DATA.layers[pkg]) return renderSinglePackage(pkg)

    if (dirPkg.has(path)) return renderMap(pkg, path)
    renderMap(pkg && DATA.layers[pkg] ? pkg : "")
  }

  arch.renderDeps = renderDeps
})()
