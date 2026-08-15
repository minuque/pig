import { MASCOT_VIEWBOX } from "./expressions.js";
import type { Eye, Face, MascotColors } from "./types.js";

export interface PaintFrame {
  face: Face;
  colors: MascotColors;
  showEars: boolean;
}

/** 深色眼：不跟 --canvas，浅色也不会变成白眼。 */
export const MASCOT_EYE = "#0f1115";

export function readMascotColors(el: HTMLElement): MascotColors {
  const styles = getComputedStyle(el);
  const primary = styles.getPropertyValue("--primary").trim() || "#4176e6";
  return {
    body: primary,
    ear: styles.getPropertyValue("--primary-active").trim() || primary,
    eye: MASCOT_EYE,
  };
}

export function paintMascot(ctx: CanvasRenderingContext2D, frame: PaintFrame): void {
  const { face, colors, showEars } = frame;
  const size = ctx.canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(size / MASCOT_VIEWBOX, size / MASCOT_VIEWBOX);

  if (showEars) {
    fillEllipse(ctx, 30, 26, 11, 13, colors.ear);
    fillEllipse(ctx, 70, 26, 11, 13, colors.ear);
  }

  fillEllipse(ctx, 50, 56, 38, 33, colors.body);
  fillEye(ctx, face.left, colors.eye);
  fillEye(ctx, face.right, colors.eye);

  ctx.restore();
}

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function fillEye(ctx: CanvasRenderingContext2D, eye: Eye, fill: string): void {
  const rx = Math.max(0.4, eye.rx);
  const ry = Math.max(0.35, eye.ry);
  fillEllipse(ctx, eye.cx, eye.cy, rx, ry, fill);
}
