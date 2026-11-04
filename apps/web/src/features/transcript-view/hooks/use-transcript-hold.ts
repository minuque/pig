import { onBeforeUnmount, shallowRef } from "vue"

/**
 * 会话切换遮罩：把视口当前 DOM 克隆成只读快照盖住，新内容就绪再揭开。
 * epoch 区分连续快切：旧探针不能揭掉下一次的遮罩。
 */
export interface TranscriptHold {
  /** 当前遮罩代次。hold 成功时递增；0 表示没有遮罩。 */
  epoch: () => number
  /** 克隆视口。返回本次代次，没有可盖内容时返回 0。 */
  hold: (viewport: HTMLElement | null | undefined) => number
  /** 淡出后移除。gen 与当前代次不符则忽略。 */
  release: (gen?: number) => void
  /** 不淡出，直接移除。超时或空会话用。 */
  dropNow: (gen?: number) => void
}

export function useTranscriptHold(): TranscriptHold {
  const node = shallowRef<HTMLElement>()
  let epoch = 0

  function drop(el: HTMLElement | undefined) {
    el?.remove()
  }

  function current(gen?: number): HTMLElement | undefined {
    if (gen !== undefined && gen !== epoch) return undefined
    return node.value
  }

  function dropNow(gen?: number) {
    const el = current(gen)

    if (!el) return
    node.value = undefined
    drop(el)
  }

  function release(gen?: number) {
    const el = current(gen)

    if (!el) return
    node.value = undefined
    el.classList.add("is-leaving")
    el.addEventListener("animationend", () => drop(el), { once: true })
    window.setTimeout(() => drop(el), 500)
  }

  function hold(viewport: HTMLElement | null | undefined): number {
    epoch += 1
    const gen = epoch
    const parent = viewport?.parentElement

    parent?.querySelectorAll(".transcript-hold").forEach((el) => el.remove())
    node.value = undefined

    if (!viewport?.querySelector(".transcript")) return 0
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
      background: "var(--card)",
      opacity: "1",
    })
    const inner = clone.querySelector<HTMLElement>(".transcript")

    if (inner) inner.style.transform = `translateY(${-viewport.scrollTop}px)`
    clone.style.width = `${box.width}px`
    clone.style.height = `${box.height}px`
    parent?.appendChild(clone)
    node.value = clone
    return gen
  }

  onBeforeUnmount(() => drop(node.value))
  return { epoch: () => epoch, hold, release, dropNow }
}
