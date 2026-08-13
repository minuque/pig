import { onBeforeUnmount, readonly, ref, watch } from "vue";
import { clampPanelWidth } from "@features/sessions/session-state.js";

/** 主内容区最小宽度（px）：侧栏调宽时始终为其保留的空间。 */
export const CONTENT_MIN_WIDTH = 332;

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
  const leftWidth = ref(clampPanelWidth(window.innerWidth * 0.18));

  function setPanelWidth(desired: number) {
    leftWidth.value = panelWidthFor(desired, window.innerWidth);
  }
  function resizeBy(delta: number) {
    setPanelWidth(leftWidth.value + delta);
  }
  function startResize(event: PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = leftWidth.value;
    const move = (next: PointerEvent) => setPanelWidth(startWidth + (next.clientX - startX));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
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
    toggle,
    resizeBy,
    startResize,
    closeMobilePanels,
  };
}
