import { onBeforeUnmount, shallowRef, type ShallowRef } from "vue"

/**
 * 会话切换遮罩：切换瞬间把 transcript 视口的当前 DOM 克隆成只读快照盖住，
 * 新内容就绪再揭开。窗口化只挂视口附近节点，克隆体小；揭开/取消即丢。
 */
export interface TranscriptHold {
  /** 克隆出来的快照节点；没有快照时为 undefined。 */
  node: ShallowRef<HTMLElement | undefined>
  /** 视口当前内容克隆成覆盖层。返回是否有内容可盖。 */
  hold: (viewport: HTMLElement | null | undefined) => boolean
  /** 揭开遮罩：播淡出动画后移除节点。 */
  release: () => void
}

export function useTranscriptHold(): TranscriptHold {
  const node = shallowRef<HTMLElement>()

  function drop(el: HTMLElement | undefined) {
    el?.remove()
  }

  function release() {
    const el = node.value
    node.value = undefined

    if (!el) return
    el.classList.add("is-leaving")
    el.addEventListener("animationend", () => drop(el), { once: true })
    // 动画被禁用或没跑时兜底移除
    window.setTimeout(() => drop(el), 500)
  }

  function hold(viewport: HTMLElement | null | undefined): boolean {
    // 连续快切：上一张还没揭开就直接丢
    drop(node.value)
    node.value = undefined

    if (!viewport) return false
    const clone = viewport.cloneNode(true) as HTMLElement
    const box = viewport.getBoundingClientRect()
    clone.removeAttribute("id")
    clone.setAttribute("aria-hidden", "true")
    clone.classList.add("transcript-hold")
    Object.assign(clone.style, {
      position: "absolute",
      inset: "0",
      zIndex: "4",
      overflow: "hidden",
      pointerEvents: "none",
      background: "var(--surface)",
      opacity: "1",
    })
    // 记录视口滚动偏移，让克隆内容停在同一位置
    const inner = clone.querySelector<HTMLElement>(".transcript")

    if (inner) inner.style.transform = `translateY(${-viewport.scrollTop}px)`
    clone.style.width = `${box.width}px`
    clone.style.height = `${box.height}px`
    viewport.parentElement?.appendChild(clone)
    node.value = clone
    return true
  }

  onBeforeUnmount(() => drop(node.value))
  return { node, hold, release }
}
