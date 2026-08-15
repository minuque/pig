import type { ExpressionId, Eye, Face } from "./types.js";

/** 逻辑画布边长。绘制时再映射到像素。 */
export const MASCOT_VIEWBOX = 100;

export const EXPRESSIONS: Record<ExpressionId, Face> = {
  awake: {
    left: { cx: 36, cy: 48, rx: 8.2, ry: 10.4 },
    right: { cx: 64, cy: 48, rx: 8.2, ry: 10.4 },
  },
  glance: {
    left: { cx: 32, cy: 49, rx: 7.6, ry: 9.6 },
    right: { cx: 60, cy: 47, rx: 7.8, ry: 10 },
  },
  think: {
    left: { cx: 38, cy: 42, rx: 7.2, ry: 8.6 },
    right: { cx: 67, cy: 40, rx: 7.4, ry: 9.2 },
  },
  focus: {
    left: { cx: 37, cy: 49, rx: 6.4, ry: 7.8 },
    right: { cx: 63, cy: 49, rx: 6.4, ry: 7.8 },
  },
  squint: {
    left: { cx: 36, cy: 50, rx: 8.4, ry: 4.6 },
    right: { cx: 64, cy: 50, rx: 8.4, ry: 4.6 },
  },
  alert: {
    left: { cx: 35, cy: 46, rx: 9.2, ry: 11.4 },
    right: { cx: 65, cy: 46, rx: 9.2, ry: 11.4 },
  },
};

export const EXPRESSION_IDS = Object.keys(EXPRESSIONS) as ExpressionId[];

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpEye(from: Eye, to: Eye, t: number): Eye {
  return {
    cx: lerp(from.cx, to.cx, t),
    cy: lerp(from.cy, to.cy, t),
    rx: lerp(from.rx, to.rx, t),
    ry: lerp(from.ry, to.ry, t),
  };
}

export function lerpFace(from: Face, to: Face, t: number): Face {
  return {
    left: lerpEye(from.left, to.left, t),
    right: lerpEye(from.right, to.right, t),
  };
}

export function cloneFace(face: Face): Face {
  return {
    left: { ...face.left },
    right: { ...face.right },
  };
}

/** 眨眼：压扁 ry，略上移，保持眼睛中心。 */
export function applyBlink(face: Face, amount: number): Face {
  const squeeze = 1 - amount * 0.9;
  return {
    left: { ...face.left, ry: face.left.ry * squeeze, cy: face.left.cy + amount * 1.2 },
    right: { ...face.right, ry: face.right.ry * squeeze, cy: face.right.cy + amount * 1.2 },
  };
}

/** gaze ∈ [-1, 1]，眼睛在眶内挪一点。 */
export function applyGaze(face: Face, x: number, y: number): Face {
  const dx = clamp(x, -1, 1) * 5.5;
  const dy = clamp(y, -1, 1) * 4.2;
  return {
    left: { ...face.left, cx: face.left.cx + dx, cy: face.left.cy + dy },
    right: { ...face.right, cx: face.right.cx + dx, cy: face.right.cy + dy },
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
