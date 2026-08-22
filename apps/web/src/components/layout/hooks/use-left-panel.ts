import { onBeforeUnmount, readonly, ref, watch } from "vue";

/** 主内容区最小宽度（px）：侧栏调宽时始终为其保留的空间。 */
export const CONTENT_MIN_WIDTH = 332;

const clampPanelWidth = (width: number) => Math.min(420, Math.max(240, width));

/** 期望宽度按侧栏上下限与视口可用空间裁剪。 */
export function panelWidthFor(desired: number, viewportWidth: number): number {
  const room = viewportWidth - CONTENT_MIN_WIDTH;
  return Math.min(clampPanelWidth(desired), Math.max(240, room));
}

/** 宽度超出可用空间时收缩到刚好放下，否则原样保留。 */
export function fitPanelWidth(width: number, viewportWidth: number): number {
  const excess = width - (viewportWidth - CONTENT_MIN_WIDTH);
  return excess > 0 ? Math.max(240, width - excess) : width;
}

/** 左栏（Workspace/Session 导航）面板：拖拽调宽、方向键调宽、移动端抽屉与视口适配。 */
export function useLeftPanel() {
  const narrowViewport = matchMedia("(max-width: 900px)");
  const leftOpen = ref(!narrowViewport.matches);
  /** 当前是否为 max-width: 900px 窄视口。 */
  const isNarrow = ref(narrowViewport.matches);
  const leftWidth = ref(clampPanelWidth(window.innerWidth * 0.18));
  const resizing = ref(false);

  function setPanelWidth(desired: number) {
    leftWidth.value = panelWidthFor(desired, window.innerWidth);
  }
  function resizeBy(delta: number) {
    setPanelWidth(leftWidth.value + delta);
  }
  function startResize(event: PointerEvent) {
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = leftWidth.value;
    resizing.value = true;
    // pointermove 用 rAF 合帧：每帧至多计算一次宽度，pointerup 后补一次最终位置
    let frame = 0;
    let pendingX = startX;
    const move = (next: PointerEvent) => {
      pendingX = next.clientX;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setPanelWidth(startWidth + (pendingX - startX));
      });
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      if (frame) cancelAnimationFrame(frame);
      setPanelWidth(startWidth + (pendingX - startX));
      resizing.value = false;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }
  function toggle() {
    leftOpen.value = !leftOpen.value;
  }
  function closeMobilePanels() {
    if (narrowViewport.matches) leftOpen.value = false;
  }
  function fitPanels() {
    if (narrowViewport.matches || !leftOpen.value) return;
    leftWidth.value = fitPanelWidth(leftWidth.value, window.innerWidth);
  }
  function handleViewportChange(event: MediaQueryListEvent) {
    isNarrow.value = event.matches;
    if (event.matches) closeMobilePanels();
    else fitPanels();
  }
  narrowViewport.addEventListener("change", handleViewportChange);
  window.addEventListener("resize", fitPanels);
  fitPanels();
  watch(leftOpen, () => void fitPanels());
  onBeforeUnmount(() => {
    narrowViewport.removeEventListener("change", handleViewportChange);
    window.removeEventListener("resize", fitPanels);
  });
  return {
    leftOpen: readonly(leftOpen),
    leftWidth: readonly(leftWidth),
    isNarrow: readonly(isNarrow),
    resizing: readonly(resizing),
    toggle,
    resizeBy,
    startResize,
    closeMobilePanels,
  };
}
