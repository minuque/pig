import { onBeforeUnmount, watch, type Ref } from "vue";
import {
  applyBlink,
  applyGaze,
  cloneFace,
  EXPRESSIONS,
  lerpFace,
  MASCOT_VIEWBOX,
} from "../lib/expressions.js";
import { MASCOT_STATES, pickNextExpression, randomDuration } from "../lib/presence.js";
import type { ExpressionId, Eye, Face, Gaze, MascotColors, MascotState } from "../types.js";

const BLINK_SECONDS = 0.32;

export function useMascotRuntime(options: {
  canvas: Ref<HTMLCanvasElement | null>;
  host: Ref<HTMLElement | null>;
  state: Ref<MascotState>;
  gaze: Ref<Gaze>;
  size: Ref<number>;
  autoBlink: Ref<boolean>;
  autoExpression: Ref<boolean>;
}) {
  const spring = new UnitSpring();
  let source = cloneFace(EXPRESSIONS.awake);
  let target = cloneFace(EXPRESSIONS.awake);
  let current: ExpressionId = "awake";
  let blinkT = -1;
  let blinkResolve: (() => void) | null = null;
  let expressionTimer = 0;
  let blinkTimer = 0;
  let frame = 0;
  let lastTs = 0;
  let reduced = false;
  let visible = true;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function syncReduced() {
    reduced = motionQuery.matches;
    if (reduced) stopLoop();
    else startLoop();
    paint();
  }

  function spec() {
    return MASCOT_STATES[options.state.value];
  }

  function morphedFace() {
    return lerpFace(source, target, Math.max(0, Math.min(1, spring.value)));
  }

  function displayedFace() {
    const gazed = applyGaze(morphedFace(), options.gaze.value.x, options.gaze.value.y);
    const blinkAmount = blinkT < 0 ? 0 : Math.sin(Math.min(1, blinkT / BLINK_SECONDS) * Math.PI);
    return applyBlink(gazed, blinkAmount);
  }

  function paint() {
    const canvas = options.canvas.value;
    const host = options.host.value;
    if (!canvas || !host) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(1, Math.round(options.size.value * dpr));
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintMascot(ctx, {
      face: displayedFace(),
      colors: readMascotColors(host),
      showEars: options.size.value >= 40,
    });
  }

  function selectExpression(next: ExpressionId, animate: boolean) {
    const face = EXPRESSIONS[next];
    if (animate && !reduced) {
      source = morphedFace();
      target = cloneFace(face);
      spring.start();
      startLoop();
    } else {
      source = cloneFace(face);
      target = cloneFace(face);
      spring.value = 1;
      spring.velocity = 0;
    }
    current = next;
    paint();
  }

  function onStateChanged() {
    const allowed = spec().expressions;
    if (!allowed.includes(current)) selectExpression(allowed[0] ?? "awake", !reduced);
    scheduleExpression();
    scheduleBlink();
    paint();
  }

  function scheduleExpression() {
    window.clearTimeout(expressionTimer);
    if (reduced || !options.autoExpression.value || !visible) return;
    const data = spec();
    expressionTimer = window.setTimeout(() => {
      selectExpression(pickNextExpression(data.expressions, current), true);
      scheduleExpression();
    }, randomDuration(data.expressionCadence));
  }

  function scheduleBlink() {
    window.clearTimeout(blinkTimer);
    if (reduced || !options.autoBlink.value || !visible) return;
    const cadence = spec().blinkCadence;
    if (!cadence) return;
    blinkTimer = window.setTimeout(() => {
      void beginBlink();
      scheduleBlink();
    }, randomDuration(cadence));
  }

  function completeBlink() {
    blinkT = -1;
    const resolve = blinkResolve;
    blinkResolve = null;
    resolve?.();
  }

  function beginBlink(): Promise<void> {
    completeBlink();
    if (reduced) {
      paint();
      return Promise.resolve();
    }
    blinkT = 0;
    startLoop();
    paint();
    return new Promise((resolve) => {
      blinkResolve = resolve;
    });
  }

  function tick(ts: number) {
    frame = 0;
    if (!visible) return;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    if (blinkT >= 0) {
      blinkT += dt;
      if (blinkT >= BLINK_SECONDS) completeBlink();
    }
    if (!spring.settled) spring.step(dt);
    paint();
    const moving =
      !spring.settled ||
      blinkT >= 0 ||
      Math.abs(options.gaze.value.x) > 0.01 ||
      Math.abs(options.gaze.value.y) > 0.01;
    if (moving && !reduced) startLoop();
  }

  function startLoop() {
    if (frame || reduced || !visible) return;
    frame = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTs = 0;
  }

  function onVisibility() {
    visible = document.visibilityState === "visible";
    if (visible) {
      scheduleExpression();
      scheduleBlink();
      startLoop();
      paint();
    } else {
      window.clearTimeout(expressionTimer);
      window.clearTimeout(blinkTimer);
      stopLoop();
    }
  }

  const stopState = watch(() => options.state.value, onStateChanged);
  const stopFlags = watch(
    () => [options.autoBlink.value, options.autoExpression.value] as const,
    () => {
      scheduleExpression();
      scheduleBlink();
    },
  );
  const stopSize = watch(
    () => options.size.value,
    () => paint(),
  );
  const stopGaze = watch(
    () => [options.gaze.value.x, options.gaze.value.y] as const,
    () => {
      if (reduced) paint();
      else startLoop();
    },
  );
  const stopCanvas = watch(
    () => [options.canvas.value, options.host.value] as const,
    () => paint(),
    { flush: "post", immediate: true },
  );

  motionQuery.addEventListener("change", syncReduced);
  document.addEventListener("visibilitychange", onVisibility);
  const themeObserver = new MutationObserver(() => paint());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  syncReduced();
  onStateChanged();

  onBeforeUnmount(() => {
    stopState();
    stopFlags();
    stopSize();
    stopGaze();
    stopCanvas();
    themeObserver.disconnect();
    motionQuery.removeEventListener("change", syncReduced);
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearTimeout(expressionTimer);
    window.clearTimeout(blinkTimer);
    completeBlink();
    stopLoop();
  });

  return { blink: beginBlink };
}

/** 过阻尼弹簧：0→1 表情过渡，中途改目标时从当前值再出发。 */
export class UnitSpring {
  value = 1;
  velocity = 0;

  constructor(
    private readonly frequency = 7,
    private readonly damping = 0.95,
  ) {}

  start(): void {
    this.value = 0;
    this.velocity = 0;
  }

  get settled(): boolean {
    return this.value >= 0.999 && Math.abs(this.velocity) < 0.01;
  }

  step(dt: number): number {
    if (this.settled) {
      this.value = 1;
      this.velocity = 0;
      return 1;
    }
    const omega = this.frequency * Math.PI * 2;
    const accel = (1 - this.value) * omega * omega - this.velocity * 2 * this.damping * omega;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    if (this.value > 1 && this.velocity > 0) {
      this.value = 1;
      this.velocity = 0;
    }
    return this.value;
  }
}

const MASCOT_EYE = "#0f1115";

function readMascotColors(el: HTMLElement): MascotColors {
  const styles = getComputedStyle(el);
  const primary = styles.getPropertyValue("--primary").trim() || "#4176e6";
  return {
    body: primary,
    ear: styles.getPropertyValue("--primary-active").trim() || primary,
    eye: MASCOT_EYE,
  };
}

function paintMascot(
  ctx: CanvasRenderingContext2D,
  frame: { face: Face; colors: MascotColors; showEars: boolean },
): void {
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
