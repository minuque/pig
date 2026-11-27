import { defineComponent, type SlotsType, type VNode } from "vue"
import { usePart, usePrimitive } from "@ui-sdk/vue/primitive"
import { createChange, definePrimitive, type ChangeDetails, type ReorderReason } from "@ui-sdk/core"
import {
  createSortableController,
  type SortableListOptions,
  type SortableMoving,
} from "./sortable-controller.js"

export type { SortableListOptions }

const sortableList = definePrimitive({
  name: "sortable-list",
  options: {
    value: "list",
    defaultValue: "list",
    onValueChange: "callback",
    orientation: "string",
    density: "string",
    liftSide: "string",
    itemLabel: "value",
    message: "value",
  },
  controlled: ["value"],
  state: (options: SortableListOptions) => ({
    value: options.value ?? options.defaultValue ?? [],
    moving: null as SortableMoving | null,
    settling: null as string | null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => createSortableController(context, createChange(context)),
  slots: (slot) => ({
    root: slot<Record<never, never>, { order: string[]; dragging: boolean }>({
      role: "list",
      state: (state) => ({ order: state.value, dragging: Boolean(state.moving?.pointer) }),
      attrs: (state, part) => ({
        "data-dragging": state.moving?.pointer ? "" : undefined,
        "data-orientation": part.api.orientation(),
      }),
      bind: (el, part) => part.api.bindRoot(el),
    }),
    item: slot<{ value: string }>({
      role: "listitem",
      props: { value: "key" },
      attrs: (state, part) => {
        const active = state.moving?.key === part.key
        const pointer = Boolean(active && state.moving?.pointer)
        const hidden = state.settling === part.key || (pointer && !state.moving?.reduced)
        return {
          "data-grabbed": active ? "" : undefined,
          "data-dragging": pointer ? "" : undefined,
          "data-keyboard-dragging": active && !pointer ? "" : undefined,
          "data-drag-hidden": hidden ? "" : undefined,
        }
      },
      bind: (el, part) => part.api.bindItem(el, part.key),
    }),
    handle: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "aria-pressed": String(state.moving?.key === part.props.value),
        "data-drag-handle": "",
      }),
      on: {
        keydown: (event, { api, props }) => {
          api.keydown(event, props.value)
        },
        pointerdown: (event, { api, props }) => api.pointerdown(event, props.value),
      },
      bind: (el, part) => part.api.bindHandle(el, part.props.value),
    }),
  }),
  agent: { actions: ["move"] },
})

type PartScope = { props: Record<string, unknown> }

export const SortableList = defineComponent(
  (props: Omit<SortableListOptions, "onValueChange" | "defaultValue">, { emit }) => {
    const handle = usePrimitive(sortableList, () => ({
      ...(props.value && { value: props.value }),
      ...(props.orientation && { orientation: props.orientation }),
      ...(props.density && { density: props.density }),
      ...(props.liftSide && { liftSide: props.liftSide }),
      ...(props.itemLabel && { itemLabel: props.itemLabel }),
      ...(props.message && { message: props.message }),
      onValueChange: (value: string[], details: ChangeDetails<ReorderReason>) =>
        emit("value-change", value, details),
    }))
    return usePart(handle, "root", undefined, undefined, "div")
  },
  {
    inheritAttrs: false,
    props: ["value", "orientation", "density", "liftSide", "itemLabel", "message"],
    emits: ["value-change"],
    slots: Object as SlotsType<{
      default?: (scope: { state: { order: string[]; dragging: boolean } }) => VNode[]
    }>,
  },
)

export const SortableListItem = defineComponent(
  (props: { value: string }) =>
    usePart(sortableList, "item", () => ({ value: props.value }), undefined, "div"),
  {
    inheritAttrs: false,
    props: ["value"],
    slots: Object as SlotsType<{ default?: () => VNode[]; render?: (scope: PartScope) => VNode[] }>,
  },
)

export const SortableListHandle = defineComponent(
  (props: { value: string }) =>
    usePart(sortableList, "handle", () => ({ value: props.value }), undefined, "button"),
  {
    inheritAttrs: false,
    props: ["value"],
    slots: Object as SlotsType<{ default?: () => VNode[]; render?: (scope: PartScope) => VNode[] }>,
  },
)
