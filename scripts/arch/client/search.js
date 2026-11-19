void (() => {
  "use strict"

  const arch = (globalThis.__arch = globalThis.__arch || {})
  const KIND_TONES = {
    包: "neutral",
    模块: "info",
    文件: "neutral",
    数据流: "ok",
    HTTP: "warn",
    WS: "info",
  }

  function initSearch() {
    const { esc, searchItems, highlightText, announce } = arch
    const dialog = document.getElementById("search-dialog")
    const trigger = document.getElementById("open-search")
    const closeBtn = document.getElementById("search-close")
    const input = document.getElementById("search-input")
    const resultsEl = document.getElementById("search-results")
    const countEl = document.getElementById("search-count")
    let lastTrigger = null
    let currentItems = []
    let activeIndex = 0
    const syncSelection = () => {
      const options = resultsEl.querySelectorAll('[role="option"]')

      options.forEach((opt, i) => {
        const selected = i === activeIndex
        opt.setAttribute("aria-selected", selected ? "true" : "false")

        if (selected) opt.scrollIntoView({ block: "nearest" })
      })

      const active = options[activeIndex]

      if (active) input.setAttribute("aria-activedescendant", active.id)
      else input.removeAttribute("aria-activedescendant")
    }
    const render = () => {
      const query = input.value
      const { items, total, isDefault } = searchItems(query)
      currentItems = items
      activeIndex = 0

      if (!items.length) {
        resultsEl.innerHTML = `
          <div class="empty-state">
            <p class="lead">未找到匹配 “${esc(query)}” 的架构项</p>
            <button class="btn-soft" id="search-clear" type="button">清空搜索</button>
          </div>
        `
        countEl.textContent = "0 个匹配"
        input.removeAttribute("aria-activedescendant")
        resultsEl.querySelector("#search-clear")?.addEventListener("click", () => {
          input.value = ""
          render()
          input.focus()
        })
        announce("没有找到匹配结果")
        return
      }

      resultsEl.innerHTML = items
        .map((item, i) => {
          const tone = KIND_TONES[item.kind] ?? "neutral"
          const titleHtml = highlightText(item.title, query)
          const subHtml = highlightText(item.sub, query)
          return `
            <a
              class="search-option"
              id="search-opt-${i}"
              role="option"
              aria-selected="${i === 0 ? "true" : "false"}"
              href="${esc(item.href)}"
            >
              <span class="search-option-main">
                <span class="status-badge" data-tone="${tone}">${esc(item.kind)}</span>
                <span class="search-option-text mono">${titleHtml}</span>
              </span>
              <span class="search-option-sub">${subHtml}</span>
            </a>
          `
        })
        .join("")

      countEl.textContent = isDefault
        ? `常用入口（共索引 ${total} 项）`
        : total > items.length
          ? `显示前 ${items.length} / ${total} 条匹配`
          : `${total} 条匹配`
      syncSelection()
    }
    const open = (sourceEl) => {
      lastTrigger = sourceEl ?? document.activeElement

      if (!dialog.open) dialog.showModal()
      render()
      input.focus()
      input.select()
    }
    const close = () => {
      if (dialog.open) dialog.close()
    }

    trigger.addEventListener("click", () => open(trigger))
    closeBtn.addEventListener("click", close)
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close()
    })
    dialog.addEventListener("close", () => {
      if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus()
      lastTrigger = null
    })
    input.addEventListener("input", render)
    input.addEventListener("keydown", (event) => {
      if (!currentItems.length) return

      if (event.key === "ArrowDown") {
        event.preventDefault()
        activeIndex = (activeIndex + 1) % currentItems.length
        syncSelection()
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        activeIndex = (activeIndex - 1 + currentItems.length) % currentItems.length
        syncSelection()
      } else if (event.key === "Home") {
        event.preventDefault()
        activeIndex = 0
        syncSelection()
      } else if (event.key === "End") {
        event.preventDefault()
        activeIndex = currentItems.length - 1
        syncSelection()
      } else if (event.key === "Enter") {
        const picked = currentItems[activeIndex]

        if (!picked) return
        event.preventDefault()
        close()
        location.hash = picked.href
      }
    })
    resultsEl.addEventListener("click", (event) => {
      const link = event.target.closest("a.search-option")

      if (link) close()
    })
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase()

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault()
        open(document.activeElement)
        return
      }

      if (event.key !== "/" || dialog.open || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target

      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return
      event.preventDefault()
      open(document.activeElement)
    })
    return {
      closeIfOpen: close,
    }
  }

  arch.initSearch = initSearch
})()
