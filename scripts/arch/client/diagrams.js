void (() => {
  "use strict"

  const arch = (globalThis.__arch = globalThis.__arch || {})

  function buildOverviewSource() {
    const { DATA, files, edges, byId, pkgs, label } = arch
    const n = (p) => `p${pkgs.indexOf(p)}`
    const counts = new Map()

    for (const e of edges) {
      const a = byId.get(e.from).pkg
      const b = byId.get(e.to).pkg

      if (a === b) continue
      const key = `${n(a)} --> ${n(b)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const lines = ["flowchart TB"]

    for (const p of pkgs) {
      const size = files.filter((f) => f.pkg === p).length
      lines.push(`  ${n(p)}["${p}<br/>${size} 个文件"]`, `  click ${n(p)} href "#dep/${p}"`)
    }

    for (const [pair, count] of counts) lines.push(`  ${pair.replace("-->", `-->|${count}|`)}`)

    for (const [from, to, text] of DATA.runtime) {
      const a = pkgs.includes(from) ? n(from) : `x${label(from).replace(/\W/g, "")}`
      const b = pkgs.includes(to) ? n(to) : `x${label(to).replace(/\W/g, "")}`

      if (!pkgs.includes(from)) lines.push(`  ${a}(["${label(from)}"])`)

      if (!pkgs.includes(to)) lines.push(`  ${b}(["${label(to)}"])`)
      lines.push(`  ${a} -.->|${label(text)}| ${b}`)
    }

    return lines.join("\n")
  }

  function buildFlowSource(flow) {
    const actors = [...new Set(flow.steps.flatMap((s) => [s.from, s.to]))]
    const a = (name) => `a${actors.indexOf(name)}`
    const lines = [
      "sequenceDiagram",
      ...actors.map((name) => `  participant ${a(name)} as ${name}`),
    ]

    flow.steps.forEach((s, i) =>
      lines.push(`  ${a(s.from)}->>${a(s.to)}: ${i + 1}. ${s.text.replace(/[;#]/g, "，")}`),
    )
    return lines.join("\n")
  }

  let previewController = null

  function initPreview() {
    if (previewController) return previewController
    const dialog = document.getElementById("preview")
    const titleEl = document.getElementById("preview-title")
    const metaEl = document.getElementById("preview-meta")
    const scaleEl = document.getElementById("preview-scale")
    const viewport = document.getElementById("preview-viewport")
    const stage = document.getElementById("preview-stage")
    const zoomOutBtn = document.getElementById("preview-zoom-out")
    const zoomInBtn = document.getElementById("preview-zoom-in")
    const fitBtn = document.getElementById("preview-fit")
    const actualBtn = document.getElementById("preview-actual")
    const copyBtn = document.getElementById("preview-copy")
    const closeBtn = document.getElementById("preview-close")
    let activeZoom = null
    let currentSource = ""
    let lastTrigger = null
    const refreshScale = () => {
      if (!activeZoom) return
      const pct = Math.round(activeZoom.scale * 100)
      scaleEl.textContent = `${pct}%`
    }
    const scheduleScale = () => requestAnimationFrame(refreshScale)
    const cleanup = () => {
      activeZoom?.destroy()
      activeZoom = null
      stage.replaceChildren()
    }

    dialog.addEventListener("close", () => {
      cleanup()

      if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus()
      lastTrigger = null
    })
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close()
    })
    closeBtn.addEventListener("click", () => dialog.close())
    zoomOutBtn.addEventListener("click", () => {
      activeZoom?.zoomBy(0.8)
      refreshScale()
    })
    zoomInBtn.addEventListener("click", () => {
      activeZoom?.zoomBy(1.25)
      refreshScale()
    })
    fitBtn.addEventListener("click", () => {
      activeZoom?.reset()
      refreshScale()
    })
    actualBtn.addEventListener("click", () => {
      activeZoom?.zoomTo(1)
      refreshScale()
    })
    copyBtn.addEventListener("click", () => arch.copyText(currentSource, copyBtn))
    viewport.addEventListener(
      "wheel",
      (event) => {
        if (!activeZoom) return

        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault()
          activeZoom.zoomBy(event.deltaY < 0 ? 1.14 : 1 / 1.14)
        }

        scheduleScale()
      },
      { passive: false },
    )
    viewport.addEventListener("pointerup", scheduleScale)
    stage.addEventListener("dblclick", scheduleScale)
    stage.addEventListener("keyup", scheduleScale)

    const open = (source, title, trigger) => {
      cleanup()
      currentSource = source
      lastTrigger = trigger ?? document.activeElement
      titleEl.textContent = title

      let rendered

      try {
        rendered = globalThis.pele.render(source, { links: true, responsive: false })
      } catch (error) {
        metaEl.textContent = "渲染失败"
        stage.innerHTML = `<p class="error">${arch.esc(error.message)}</p>`
        dialog.showModal()
        return
      }

      metaEl.textContent = `${rendered.type} · ${rendered.width} × ${rendered.height}`
      stage.innerHTML = rendered.svg
      dialog.showModal()
      requestAnimationFrame(() => {
        const svgEl = stage.querySelector("svg")

        if (!svgEl) return
        const pad = 32
        const availW = Math.max(120, viewport.clientWidth - pad)
        const availH = Math.max(120, viewport.clientHeight - pad)
        const fit = Math.min(availW / rendered.width, availH / rendered.height, 1)
        svgEl.style.width = `${Math.max(1, Math.round(rendered.width * fit))}px`
        svgEl.style.height = `${Math.max(1, Math.round(rendered.height * fit))}px`
        svgEl.style.maxWidth = "100%"
        activeZoom = globalThis.pele.enableZoom(stage, {
          always: true,
          maxScale: 4,
          controls: false,
        })
        refreshScale()
      })
    }

    previewController = {
      open,
      closeIfOpen: () => {
        if (dialog.open) dialog.close()
      },
    }
    return previewController
  }

  function mountDiagram(parent, source, options) {
    const { title, legendHtml = "" } = options
    const { esc, ICONS } = arch
    const controller = initPreview()
    const panel = document.createElement("div")
    panel.className = "diagram-panel"
    panel.innerHTML = `
      <div class="diagram-bar">
        <div class="diagram-bar-info">
          <span class="meta">${legendHtml || esc(title)}</span>
        </div>
        <button class="btn-ghost diagram-expand" type="button">${ICONS.expand}<span>放大查看</span></button>
      </div>
      <div class="diagram-canvas mermaid-diagram"></div>
    `
    parent.append(panel)
    const canvas = panel.querySelector(".diagram-canvas")
    const expandBtn = panel.querySelector(".diagram-expand")

    try {
      const result = globalThis.pele.render(source, { links: true, responsive: false })
      canvas.innerHTML = result.svg
      canvas.dataset.interactive = "true"
      expandBtn.addEventListener("click", () => controller.open(source, title, expandBtn))
      canvas.addEventListener("click", (event) => {
        if (!event.target.closest("a")) controller.open(source, title, expandBtn)
      })
    } catch (error) {
      expandBtn.disabled = true
      canvas.innerHTML = `<p class="error">${esc(error.message)}</p>`
    }

    return panel
  }

  Object.assign(arch, {
    buildOverviewSource,
    buildFlowSource,
    initPreview,
    mountDiagram,
  })
})()
