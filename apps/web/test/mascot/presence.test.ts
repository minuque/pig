import { describe, expect, it } from "vitest";
import { EXPRESSIONS, EXPRESSION_IDS, applyBlink, lerpFace } from "@features/mascot/expressions.js";
import {
  MASCOT_STATES,
  mascotStateFromPhase,
  pickNextExpression,
  randomDuration,
} from "@features/mascot/presence.js";
import { UnitSpring } from "@features/mascot/spring.js";

describe("mascot presence", () => {
  it("maps Pi phase onto mascot states without inventing extra phases", () => {
    expect(mascotStateFromPhase(undefined)).toBe("idle");
    expect(mascotStateFromPhase("idle")).toBe("idle");
    expect(mascotStateFromPhase("turn")).toBe("working");
    expect(mascotStateFromPhase("compaction")).toBe("compacting");
    expect(mascotStateFromPhase("retry")).toBe("retrying");
    expect(mascotStateFromPhase("branch_summary")).toBe("thinking");
  });

  it("keeps every state expression inside the shared face table", () => {
    for (const spec of Object.values(MASCOT_STATES)) {
      expect(spec.expressions.length).toBeGreaterThan(0);
      for (const id of spec.expressions) {
        expect(EXPRESSION_IDS).toContain(id);
        expect(EXPRESSIONS[id].left.rx).toBeGreaterThan(0);
        expect(EXPRESSIONS[id].right.rx).toBeGreaterThan(0);
      }
    }
  });

  it("picks another expression when alternatives exist", () => {
    expect(pickNextExpression(["awake", "think"], "awake", () => 0)).toBe("think");
    expect(pickNextExpression(["awake"], "awake")).toBe("awake");
  });

  it("stays inside cadence bounds", () => {
    const cadence = { min: 10, max: 20 };
    for (let i = 0; i < 8; i++) {
      const ms = randomDuration(cadence, () => i / 7);
      expect(ms).toBeGreaterThanOrEqual(10);
      expect(ms).toBeLessThanOrEqual(20);
    }
  });
});

describe("mascot motion", () => {
  it("interpolates faces and blink without breaking topology", () => {
    const mixed = lerpFace(EXPRESSIONS.awake, EXPRESSIONS.think, 0.5);
    expect(mixed.left.cy).toBe((EXPRESSIONS.awake.left.cy + EXPRESSIONS.think.left.cy) / 2);
    const closed = applyBlink(EXPRESSIONS.awake, 1);
    expect(closed.left.ry).toBeCloseTo(EXPRESSIONS.awake.left.ry * 0.1);
  });

  it("settles a unit spring toward 1", () => {
    const spring = new UnitSpring();
    spring.start();
    expect(spring.value).toBe(0);
    for (let i = 0; i < 90; i++) spring.step(1 / 60);
    expect(spring.settled).toBe(true);
    expect(spring.value).toBe(1);
  });
});
