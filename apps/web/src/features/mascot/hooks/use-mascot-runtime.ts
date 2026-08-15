import { onBeforeUnmount, watch, type Ref } from "vue";
import { applyBlink, applyGaze, cloneFace, EXPRESSIONS, lerpFace } from "../expressions.js";
import { paintMascot, readMascotColors } from "../paint.js";
import { MASCOT_STATES, pickNextExpression, randomDuration } from "../presence.js";
import { UnitSpring } from "../spring.js";
import type { ExpressionId, Gaze, MascotState } from "../types.js";

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
