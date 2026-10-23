import type { Component } from "vue"
import AlertDialogPreview from "@/canvas/previews/AlertDialogPreview.vue"
import AlertPreview from "@/canvas/previews/AlertPreview.vue"
import ButtonPreview from "@/canvas/previews/ButtonPreview.vue"
import ContextMenuPreview from "@/canvas/previews/ContextMenuPreview.vue"
import DialogPreview from "@/canvas/previews/DialogPreview.vue"
import DropdownPreview from "@/canvas/previews/DropdownPreview.vue"
import SliderPreview from "@/canvas/previews/SliderPreview.vue"
import SpinnerPreview from "@/canvas/previews/SpinnerPreview.vue"
import SwitchPreview from "@/canvas/previews/SwitchPreview.vue"
import TooltipPreview from "@/canvas/previews/TooltipPreview.vue"

export type CanvasItemSpec = {
  id: string
  name: string
  component: Component
  props: Record<string, unknown>
  x: number
  y: number
  width: number
  height: number
  fill: boolean
}

type Spec = Omit<CanvasItemSpec, "x" | "y">

const GAP = 40
const ORIGIN = 24
const ROW_LIMIT = 1040

function place(specs: Spec[]): CanvasItemSpec[] {
  let x = ORIGIN
  let y = ORIGIN
  let rowHeight = 0
  return specs.map((spec) => {
    const blockWidth = Math.max(spec.width, 180)
    const blockHeight = spec.height + 28

    if (x > ORIGIN && x + blockWidth > ROW_LIMIT) {
      x = ORIGIN
      y += rowHeight + GAP
      rowHeight = 0
    }

    const item = { ...spec, x, y }
    x += blockWidth + GAP
    rowHeight = Math.max(rowHeight, blockHeight)
    return item
  })
}

export const LABEL_BLOCK = 28
export const canvasItems: CanvasItemSpec[] = place([
  {
    id: "button-default",
    name: "Button · default",
    component: ButtonPreview,
    props: { label: "保存" },
    width: 120,
    height: 48,
    fill: false,
  },
  {
    id: "button-outline",
    name: "Button · outline",
    component: ButtonPreview,
    props: { variant: "outline", label: "取消" },
    width: 120,
    height: 48,
    fill: false,
  },
  {
    id: "button-destructive",
    name: "Button · destructive",
    component: ButtonPreview,
    props: { variant: "destructive", label: "删除" },
    width: 120,
    height: 48,
    fill: false,
  },
  {
    id: "button-disabled",
    name: "Button · disabled",
    component: ButtonPreview,
    props: { disabled: true, label: "不可用" },
    width: 120,
    height: 48,
    fill: false,
  },
  {
    id: "button-icon",
    name: "Button · icon",
    component: ButtonPreview,
    props: { size: "icon", label: "" },
    width: 48,
    height: 48,
    fill: false,
  },
  {
    id: "alert-default",
    name: "Alert · default",
    component: AlertPreview,
    props: { title: "提示", body: "默认提示，只存在于画布。" },
    width: 280,
    height: 76,
    fill: true,
  },
  {
    id: "alert-error",
    name: "Alert · error",
    component: AlertPreview,
    props: { variant: "error", title: "错误", body: "示例错误，没有请求。" },
    width: 280,
    height: 76,
    fill: true,
  },
  {
    id: "alert-info",
    name: "Alert · info",
    component: AlertPreview,
    props: { variant: "info", title: "说明", body: "示例说明。" },
    width: 280,
    height: 76,
    fill: true,
  },
  {
    id: "alert-success",
    name: "Alert · success",
    component: AlertPreview,
    props: { variant: "success", title: "完成", body: "示例成功。" },
    width: 280,
    height: 76,
    fill: true,
  },
  {
    id: "alert-warning",
    name: "Alert · warning",
    component: AlertPreview,
    props: { variant: "warning", title: "注意", body: "示例警告。" },
    width: 280,
    height: 76,
    fill: true,
  },
  {
    id: "alert-dismissible",
    name: "Alert · dismissible",
    component: AlertPreview,
    props: { variant: "error", dismissible: true, title: "可关闭", body: "关闭只影响这一块。" },
    width: 280,
    height: 76,
    fill: true,
  },
  {
    id: "switch-on",
    name: "Switch · on",
    component: SwitchPreview,
    props: { initial: true },
    width: 64,
    height: 40,
    fill: false,
  },
  {
    id: "switch-off",
    name: "Switch · off",
    component: SwitchPreview,
    props: { initial: false },
    width: 64,
    height: 40,
    fill: false,
  },
  {
    id: "switch-disabled",
    name: "Switch · disabled",
    component: SwitchPreview,
    props: { initial: true, disabled: true },
    width: 64,
    height: 40,
    fill: false,
  },
  {
    id: "slider-value",
    name: "Slider · value",
    component: SliderPreview,
    props: { initial: 40 },
    width: 220,
    height: 40,
    fill: true,
  },
  {
    id: "slider-disabled",
    name: "Slider · disabled",
    component: SliderPreview,
    props: { initial: 20, disabled: true },
    width: 220,
    height: 40,
    fill: true,
  },
  {
    id: "spinner-default",
    name: "Spinner · default",
    component: SpinnerPreview,
    props: { size: 16 },
    width: 40,
    height: 40,
    fill: false,
  },
  {
    id: "tooltip-hint",
    name: "Tooltip · hint",
    component: TooltipPreview,
    props: {},
    width: 120,
    height: 48,
    fill: false,
  },
  {
    id: "dropdown-actions",
    name: "Dropdown menu · actions",
    component: DropdownPreview,
    props: {},
    width: 120,
    height: 48,
    fill: false,
  },
  {
    id: "context-actions",
    name: "Context menu · actions",
    component: ContextMenuPreview,
    props: {},
    width: 200,
    height: 88,
    fill: true,
  },
  {
    id: "dialog-rename",
    name: "Dialog · rename",
    component: DialogPreview,
    props: {},
    width: 120,
    height: 48,
    fill: false,
  },
  {
    id: "alert-dialog-discard",
    name: "Alert dialog · discard",
    component: AlertDialogPreview,
    props: {},
    width: 120,
    height: 48,
    fill: false,
  },
])
