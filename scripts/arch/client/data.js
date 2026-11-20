void (() => {
  "use strict"

  const arch = (globalThis.__arch = globalThis.__arch || {})
  const DATA = globalThis.__ARCH_DATA__
  const { files, edges } = DATA.graph
  const byId = new Map(files.map((f) => [f.id, f]))
  const dirPkg = new Map(files.map((f) => [f.dir, f.pkg]))
  const importers = new Map()
  const imports = new Map()
  const dirFiles = new Map()
  const pkgFiles = new Map()

  for (const f of files) {
    if (!dirFiles.has(f.dir)) dirFiles.set(f.dir, [])

    if (!pkgFiles.has(f.pkg)) pkgFiles.set(f.pkg, [])
    dirFiles.get(f.dir).push(f)
    pkgFiles.get(f.pkg).push(f)
  }

  for (const e of edges) {
    if (!importers.has(e.to)) importers.set(e.to, [])

    if (!imports.has(e.from)) imports.set(e.from, [])
    importers.get(e.to).push(e.from)
    imports.get(e.from).push(e.to)
  }

  const rootBands = DATA.layers[""]?.bands ?? []
  const orderedPkgs = rootBands.flatMap((b) => b.keys)
  const pkgs = [...new Set([...orderedPkgs, ...pkgFiles.keys()])].filter((p) => pkgFiles.has(p))
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    )
  const label = (s) => String(s).replace(/"/g, "'")
  const tail = (id, parent) =>
    parent && id.startsWith(`${parent}/`) ? id.slice(parent.length + 1) : id
  const pkgOf = (focus) => (dirPkg.has(focus) ? dirPkg.get(focus) : focus)
  const short = (key, focus) => tail(key, focus).replace(/^src\//, "")
  const depLink = (id, text = id) => `<a class="mono" href="#dep/${esc(id)}">${esc(text)}</a>`

  function splitName(text) {
    const at = text.lastIndexOf("/") + 1
    return { prefix: text.slice(0, at), main: text.slice(at) }
  }

  function fileNameHtml(id, dir) {
    const { prefix, main } = splitName(tail(id, dir))
    return `<span class="mono">${prefix ? `<span class="faint">${esc(prefix)}</span>` : ""}${esc(main)}</span>`
  }

  function formatRoutePath(path) {
    return esc(path).replace(/(:[A-Za-z0-9_]+|\*)/g, '<span class="route-param">$1</span>')
  }

  function pairsOf(focus) {
    const keyOf = (f) => (focus ? f.dir : f.pkg)
    const pairs = new Map()

    for (const e of edges) {
      const a = byId.get(e.from)
      const b = byId.get(e.to)

      if (focus && (a.pkg !== focus || b.pkg !== focus)) continue

      if (keyOf(a) === keyOf(b)) continue
      const key = `${keyOf(a)}\n${keyOf(b)}`

      if (!pairs.has(key)) pairs.set(key, [])
      pairs.get(key).push(e)
    }

    return pairs
  }

  function crossPkgPairs(pkg) {
    const users = new Map()
    const uses = new Map()
    let inEdges = 0
    let outEdges = 0

    for (const e of edges) {
      const fromPkg = byId.get(e.from).pkg
      const toPkg = byId.get(e.to).pkg

      if (fromPkg === toPkg) continue

      if (toPkg === pkg) {
        if (!users.has(fromPkg)) users.set(fromPkg, [])
        users.get(fromPkg).push(e)
        inEdges++
      } else if (fromPkg === pkg) {
        if (!uses.has(toPkg)) uses.set(toPkg, [])
        uses.get(toPkg).push(e)
        outEdges++
      }
    }

    return { users, uses, inEdges, outEdges }
  }

  function healthSummary() {
    let totalCycles = 0
    let totalViolations = 0
    let firstBadFocus = null
    const issuesByFocus = new Map()

    for (const [focus, view] of Object.entries(DATA.layers)) {
      const count = view.cycles.length + view.violations.length
      totalCycles += view.cycles.length
      totalViolations += view.violations.length
      issuesByFocus.set(focus, count)

      if (count > 0 && firstBadFocus === null) firstBadFocus = focus
    }

    return {
      totalCycles,
      totalViolations,
      totalIssues: totalCycles + totalViolations,
      firstBadFocus,
      issuesByFocus,
    }
  }

  function pkgStats(pkg) {
    const topBand = rootBands.find((b) => b.keys.includes(pkg))
    const subBands = DATA.layers[pkg]?.bands ?? []
    const dirSet = new Set((pkgFiles.get(pkg) ?? []).map((f) => f.dir))
    const cross = crossPkgPairs(pkg)
    return {
      pkg,
      fileCount: pkgFiles.get(pkg)?.length ?? 0,
      dirCount: dirSet.size,
      topLayer: topBand?.name ?? "工作区",
      subLayers: subBands.map((b) => b.name),
      inPkgCount: cross.users.size,
      outPkgCount: cross.uses.size,
      inEdges: cross.inEdges,
      outEdges: cross.outEdges,
      issues: DATA.layers[pkg]
        ? DATA.layers[pkg].cycles.length + DATA.layers[pkg].violations.length
        : 0,
    }
  }

  function impactLayers(path) {
    const seen = new Set([path])
    const layers = []
    let front = [path]

    while (front.length) {
      front = [...new Set(front.flatMap((id) => importers.get(id) ?? []))].filter(
        (id) => !seen.has(id),
      )

      for (const id of front) seen.add(id)

      if (front.length) layers.push(front)
    }

    return layers
  }

  function buildSearchIndex() {
    const items = []

    for (const pkg of pkgs) {
      const stats = pkgStats(pkg)
      items.push({
        kind: "包",
        title: pkg,
        sub: `${stats.topLayer} · ${stats.fileCount} 文件`,
        extra: stats.subLayers.join(" "),
        href: `#dep/${pkg}`,
        rank: 30,
      })
    }

    for (const [dir, list] of dirFiles) {
      const pkg = dirPkg.get(dir)
      items.push({
        kind: "模块",
        title: short(dir, pkg),
        sub: `${pkg} · ${list.length} 文件`,
        extra: dir,
        href: `#dep/${dir}`,
        rank: 20,
      })
    }

    for (const f of files) {
      const into = importers.get(f.id)?.length ?? 0
      const out = imports.get(f.id)?.length ?? 0
      items.push({
        kind: "文件",
        title: tail(f.id, f.pkg),
        sub: `${f.pkg} · 被用 ${into} · 引用 ${out}`,
        extra: f.id,
        href: `#dep/${f.id}`,
        rank: Math.min(18, into),
      })
    }

    for (const flow of DATA.flows) {
      items.push({
        kind: "数据流",
        title: flow.title,
        sub: `${flow.channel.toUpperCase()} · ${flow.steps.length} 步`,
        extra: flow.steps.map((s) => `${s.from} ${s.to} ${s.text} ${s.ref ?? ""}`).join(" "),
        href: `#flows/${flow.id}`,
        rank: 25,
      })
    }

    for (const r of DATA.api.http) {
      items.push({
        kind: "HTTP",
        title: `${r.method} ${r.path}`,
        sub: tail(r.handler, "packages/gateway/src"),
        extra: r.callers.join(" "),
        href: `#api?q=${encodeURIComponent(r.path)}`,
        rank: 22,
      })
    }

    for (const cmd of DATA.api.ws.commands) {
      items.push({
        kind: "WS",
        title: cmd,
        sub: `WS 命令 · ${DATA.api.ws.path}`,
        extra: "websocket command",
        href: `#api?q=${encodeURIComponent(cmd)}`,
        rank: 22,
      })
    }

    for (const evt of DATA.api.ws.events) {
      items.push({
        kind: "WS",
        title: evt,
        sub: `WS 事件 · ${DATA.api.ws.path}`,
        extra: "websocket event",
        href: `#api?q=${encodeURIComponent(evt)}`,
        rank: 22,
      })
    }

    return items
  }

  const SEARCH_INDEX = buildSearchIndex()

  function searchItems(query) {
    const clean = query.trim().toLowerCase()

    if (!clean) {
      const featured = [
        ...SEARCH_INDEX.filter((x) => x.kind === "包").slice(0, 4),
        ...SEARCH_INDEX.filter((x) => x.kind === "数据流").slice(0, 4),
        ...SEARCH_INDEX.filter((x) => x.kind === "文件")
          .sort((a, b) => b.rank - a.rank)
          .slice(0, 4),
      ]
      return { items: featured, total: SEARCH_INDEX.length, isDefault: true }
    }

    const terms = clean.split(/\s+/).filter(Boolean)
    const scored = []

    for (const item of SEARCH_INDEX) {
      const titleLower = item.title.toLowerCase()
      const hay = `${titleLower} ${item.sub.toLowerCase()} ${item.extra.toLowerCase()}`

      if (!terms.every((t) => hay.includes(t))) continue
      let score = item.rank

      if (titleLower === clean) score += 120
      else if (titleLower.startsWith(clean)) score += 70
      else if (terms.every((t) => titleLower.includes(t))) score += 40
      scored.push({ item, score })
    }

    scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    return {
      items: scored.slice(0, 40).map((s) => s.item),
      total: scored.length,
      isDefault: false,
    }
  }

  function highlightText(text, query) {
    const terms = query
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)

    if (!terms.length) return esc(text)
    const lower = text.toLowerCase()
    const ranges = []

    for (const term of terms) {
      const needle = term.toLowerCase()
      let from = 0

      while (from < lower.length) {
        const idx = lower.indexOf(needle, from)

        if (idx < 0) break
        ranges.push([idx, idx + needle.length])
        from = idx + needle.length
      }
    }

    if (!ranges.length) return esc(text)
    ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const merged = []

    for (const [start, end] of ranges) {
      const prev = merged[merged.length - 1]

      if (prev && start <= prev[1]) prev[1] = Math.max(prev[1], end)
      else merged.push([start, end])
    }

    let out = ""
    let cursor = 0

    for (const [start, end] of merged) {
      out += esc(text.slice(cursor, start))
      out += `<mark>${esc(text.slice(start, end))}</mark>`
      cursor = end
    }

    return out + esc(text.slice(cursor))
  }

  function announce(message) {
    const region = document.getElementById("live-status")

    if (!region) return
    region.textContent = ""
    requestAnimationFrame(() => {
      region.textContent = message
    })
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement("textarea")
      area.value = text
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.append(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }

    announce(`已复制 ${text}`)

    if (!button) return
    const prevHtml = button.dataset.origHtml ?? button.innerHTML
    const prevLabel = button.dataset.origLabel ?? button.getAttribute("aria-label") ?? ""
    button.dataset.origHtml = prevHtml
    button.dataset.origLabel = prevLabel
    button.innerHTML = button.dataset.copyIconOnly
      ? ICONS.check
      : `${ICONS.check}<span>已复制</span>`

    if (prevLabel) button.setAttribute("aria-label", "已复制")
    clearTimeout(Number(button.dataset.copyTimer || 0))

    const timer = setTimeout(() => {
      button.innerHTML = prevHtml

      if (prevLabel) button.setAttribute("aria-label", prevLabel)
    }, 1500)

    button.dataset.copyTimer = String(timer)
  }

  const ICONS = {
    chevron:
      '<svg class="rel-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    copy: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check:
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    expand:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 3 6 6M9 21l-6-6M21 3l-7 7M3 21l7-7"/></svg>',
    search:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    ok: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>',
    warn: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    arrowRight:
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
    arrowLeft:
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6 6-6-6 6-6"/></svg>',
  }

  function initTheme() {
    const THEME_KEY = "pig-arch-theme"
    const systemDark = matchMedia("(prefers-color-scheme: dark)")
    const themeButton = document.getElementById("theme")
    const apply = (suppressTransition) => {
      let style = null

      if (suppressTransition) {
        style = document.createElement("style")
        style.textContent = "*,*::before,*::after{transition:none !important}"
        document.head.append(style)
      }

      let stored = null

      try {
        stored = localStorage.getItem(THEME_KEY)
      } catch {}

      const isDark = (stored ?? (systemDark.matches ? "dark" : "light")) === "dark"
      document.documentElement.classList.toggle("dark", isDark)
      themeButton.innerHTML = isDark ? ICONS.sun : ICONS.moon
      themeButton.title = isDark ? "切换到浅色主题" : "切换到深色主题"
      themeButton.setAttribute("aria-label", themeButton.title)

      if (style) {
        void document.body.offsetHeight
        requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
      }
    }

    apply(false)
    systemDark.addEventListener("change", () => apply(true))
    themeButton.addEventListener("click", () => {
      const next = document.documentElement.classList.contains("dark") ? "light" : "dark"

      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {}

      apply(true)
      announce(next === "dark" ? "已切换到深色主题" : "已切换到浅色主题")
    })
  }

  Object.assign(arch, {
    DATA,
    files,
    edges,
    byId,
    dirPkg,
    importers,
    imports,
    dirFiles,
    pkgFiles,
    pkgs,
    esc,
    label,
    tail,
    pkgOf,
    short,
    splitName,
    fileNameHtml,
    depLink,
    formatRoutePath,
    pairsOf,
    crossPkgPairs,
    healthSummary,
    pkgStats,
    impactLayers,
    searchItems,
    highlightText,
    announce,
    copyText,
    initTheme,
    ICONS,
  })
})()
