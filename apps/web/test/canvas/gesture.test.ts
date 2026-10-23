import { describe, expect, it } from "vitest"
import {
  canScrollBox,
  focusAllowsSpacePan,
  pointerIntent,
  wheelIntent,
  wheelZoomFactor,
} from "@/canvas/gesture.js"

describe("画布手势", () => {
  it("空白处拖移，手柄移动，预览本身不拖", () => {
    expect(
      pointerIntent({
        button: 0,
        buttons: 1,
        spaceHeld: false,
        spaceAllowed: true,
        onHandle: false,
        onEmpty: true,
        onControls: false,
      }),
    ).toBe("pan")
    expect(
      pointerIntent({
        button: 0,
        buttons: 1,
        spaceHeld: false,
        spaceAllowed: true,
        onHandle: true,
        onEmpty: false,
        onControls: false,
      }),
    ).toBe("move")
    expect(
      pointerIntent({
        button: 0,
        buttons: 1,
        spaceHeld: false,
        spaceAllowed: true,
        onHandle: false,
        onEmpty: false,
        onControls: false,
      }),
    ).toBe("ignore")
  })

  it("空格或中键优先于移动和复制", () => {
    expect(
      pointerIntent({
        button: 0,
        buttons: 1,
        spaceHeld: true,
        spaceAllowed: true,
        onHandle: true,
        onEmpty: false,
        onControls: false,
      }),
    ).toBe("pan")
    expect(
      pointerIntent({
        button: 1,
        buttons: 4,
        spaceHeld: false,
        spaceAllowed: true,
        onHandle: false,
        onEmpty: false,
        onControls: true,
      }),
    ).toBe("pan")
  })

  it("焦点在控件或可编辑区时不武装空格平移", () => {
    expect(focusAllowsSpacePan("BUTTON", null, false)).toBe(false)
    expect(focusAllowsSpacePan("INPUT", null, false)).toBe(false)
    expect(focusAllowsSpacePan("DIV", "slider", false)).toBe(false)
    expect(focusAllowsSpacePan("DIV", null, true)).toBe(false)
    expect(focusAllowsSpacePan("DIV", null, false)).toBe(true)
    expect(
      pointerIntent({
        button: 0,
        buttons: 1,
        spaceHeld: true,
        spaceAllowed: false,
        onHandle: false,
        onEmpty: false,
        onControls: false,
      }),
    ).toBe("ignore")
  })

  it("修饰滚轮缩放优先于嵌套滚动，滚到头才平移画布", () => {
    expect(
      wheelIntent({
        ctrlKey: true,
        metaKey: false,
        deltaX: 0,
        deltaY: 10,
        canScrollX: true,
        canScrollY: true,
      }),
    ).toBe("zoom")
    expect(
      wheelIntent({
        ctrlKey: false,
        metaKey: false,
        deltaX: 0,
        deltaY: 12,
        canScrollX: false,
        canScrollY: true,
      }),
    ).toBe("native")
    expect(
      wheelIntent({
        ctrlKey: false,
        metaKey: false,
        deltaX: 4,
        deltaY: 0,
        canScrollX: false,
        canScrollY: false,
      }),
    ).toBe("pan")
  })

  it("嵌套滚动只在该方向还能滚时接管", () => {
    const box = {
      scrollTop: 0,
      scrollLeft: 0,
      scrollHeight: 200,
      scrollWidth: 100,
      clientHeight: 80,
      clientWidth: 100,
      overflowX: "hidden",
      overflowY: "auto",
    }

    expect(canScrollBox(box, "y", 10)).toBe(true)
    expect(canScrollBox({ ...box, scrollTop: 120 }, "y", 10)).toBe(false)
    expect(canScrollBox(box, "y", -10)).toBe(false)
    expect(canScrollBox(box, "x", 10)).toBe(false)
  })

  it("滚轮两个方向都改变缩放", () => {
    expect(wheelZoomFactor(100, 0)).toBeLessThan(1)
    expect(wheelZoomFactor(-100, 0)).toBeGreaterThan(1)
  })
})
