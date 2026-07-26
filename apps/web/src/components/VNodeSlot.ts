import type { FunctionalComponent, VNodeChild } from "vue";

/**
 * Renders pre-built VNodes inside a template. The VNodes are produced by the
 * safe Markdown/Shiki converters (never HTML strings), so this component is
 * the only bridge between token conversion and the DOM.
 */
export const VNodeSlot: FunctionalComponent<{ nodes: VNodeChild }> = (props) => props.nodes;
