import type { SessionPhase } from "@earendil-works/pi-protocol";
import type { MascotSpec, MascotState } from "./types.js";

export const MASCOT_STATES: Record<MascotState, MascotSpec> = {
  idle: {
    expressions: ["awake", "glance", "squint"],
    expressionCadence: { min: 9000, max: 16000 },
    blinkCadence: { min: 6000, max: 14000 },
  },
  thinking: {
    expressions: ["think", "focus", "glance"],
    expressionCadence: { min: 2000, max: 3600 },
    blinkCadence: { min: 3500, max: 7000 },
  },
  working: {
    expressions: ["focus", "think"],
    expressionCadence: { min: 1600, max: 2400 },
    blinkCadence: { min: 2800, max: 5200 },
  },
  compacting: {
    expressions: ["squint", "think"],
    expressionCadence: { min: 2800, max: 4800 },
    blinkCadence: { min: 4000, max: 8000 },
  },
  retrying: {
    expressions: ["alert", "focus"],
    expressionCadence: { min: 1200, max: 2000 },
    blinkCadence: { min: 1800, max: 3600 },
  },
};

/** Pi phase → 吉祥物状态。未知/空闲保持 idle，不编造运行态。 */
export function mascotStateFromPhase(phase: SessionPhase | undefined): MascotState {
  switch (phase) {
    case "turn":
      return "working";
    case "compaction":
      return "compacting";
    case "retry":
      return "retrying";
    case "branch_summary":
      return "thinking";
    default:
      return "idle";
  }
}

export function randomDuration(
  cadence: { min: number; max: number },
  random = Math.random,
): number {
  const span = Math.max(cadence.min, cadence.max) - cadence.min;
  const unit = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  return cadence.min + Math.floor(unit * (span + 1));
}

export function pickNextExpression<T>(options: readonly T[], current: T, random = Math.random): T {
  const alternatives = options.filter((item) => item !== current);
  if (alternatives.length === 0) return options[0] ?? current;
  return alternatives[Math.floor(random() * alternatives.length)] ?? current;
}
