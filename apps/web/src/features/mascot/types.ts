/** 椭圆眼：所有表情共用同一拓扑，靠参数插值变形。 */
export interface Eye {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Face {
  left: Eye;
  right: Eye;
}

export type ExpressionId = "awake" | "glance" | "think" | "focus" | "squint" | "alert";

export type MascotState = "idle" | "thinking" | "working" | "compacting" | "retrying";

export interface Cadence {
  min: number;
  max: number;
}

/** 状态 = 表情子集 + 换表情/眨眼节奏。 */
export interface MascotSpec {
  expressions: readonly ExpressionId[];
  expressionCadence: Cadence;
  blinkCadence: Cadence | null;
}

export interface Gaze {
  x: number;
  y: number;
}

export interface MascotColors {
  body: string;
  ear: string;
  eye: string;
}
