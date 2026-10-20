<template>
  <svg
    class="running-pig"
    :class="[state, { 'zzz-on': state === 'idle' }]"
    viewBox="-10 0 148 102"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <text v-if="state === 'idle'" class="zzz zzz-1" x="20" y="30">Z</text>
    <text v-if="state === 'idle'" class="zzz zzz-2" x="34" y="14">z</text>

    <path
      v-if="state === 'long' || state === 'xlong'"
      class="sweat sweat-1"
      d="M14 12c2-4 5-4 6 0 1 3-1.5 6-4 6s-3-3-2-6z"
    />

    <path
      v-if="state === 'long' || state === 'xlong'"
      class="sweat sweat-2"
      d="M110 8c2-4 5-4 6 0 1 3-1.5 6-4 6s-3-3-2-6z"
    />

    <g class="g">
      <path
        class="tail"
        d="M114 97H123C126 97 129 96 130.5 93.5C132 91 131.5 88 129 87.5C126.5 87 125 90 126.5 92.5C128 95 132 95.5 134.5 93.5C135.5 92.7 136 91.5 136.2 90"
      />

      <path
        class="ear ear-l"
        d="M40 24L42 14.5C37 9.5 27 3.5 21 3.8 16.5 4 15 7 15 12c0 6 .5 14 3 22L24 46 46 34z"
      />

      <path
        class="ear ear-r"
        d="M88 24l-2-9.5c5-5 15-11 21-10.7 4.5.2 6 3.2 6 8.2 0 6-.5 14-3 22L104 46 82 34z"
      />

      <path class="head" d="M11.84 100.86a60 60 0 1 1 104.32 0z" />

      <g v-if="state === 'xlong'" class="steam">
        <path d="M50 18q3-5 0-9t0-8" />
        <path d="M64 14q3-5 0-9t0-8" />
        <path d="M78 18q3-5 0-9t0-8" />
      </g>

      <g class="face">
        <circle v-if="state === 'long'" class="blush" cx="30" cy="60" r="10" />
        <circle v-if="state === 'long'" class="blush" cx="98" cy="60" r="10" />
        <ellipse class="snout" cx="64" cy="63.5" rx="17.14" ry="10.84" />
        <path v-if="state === 'idle'" class="mouth" d="M57.05 80.14q6.95 6 13.9 0" />
        <ellipse v-else-if="state === 'run'" class="open-mouth" cx="64" cy="80" rx="5" ry="3" />

        <ellipse
          v-else-if="state === 'long' || state === 'xlong'"
          class="open-mouth"
          cx="64"
          cy="80"
          rx="6"
          ry="4"
        />

        <path v-else class="mouth mouth-ready" d="M55 80.14q9 8 18 0" />

        <g v-if="state === 'idle'" class="eyes">
          <path class="eye-closed" d="M36 51c2 3 5 4 10 4M82 51c2 3 5 4 10 4" />
        </g>

        <g v-else class="eyes">
          <ellipse class="eye" cx="41.56" cy="50.9" rx="5.04" ry="5.8" />
          <ellipse class="eye" cx="86.44" cy="50.9" rx="5.04" ry="5.8" />
          <circle class="glint" cx="42.06" cy="48.1" r="1.76" />
          <circle class="glint" cx="86.94" cy="48.1" r="1.76" />
        </g>
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
/**
 * 奔跑小猪：turn 状态指示器，hero-mascot 等比缩。
 * state：
 *   idle    空闲（闭眼 + Zzz）
 *   run     <5min（摇摆 + 张嘴）
 *   long    5min（摇摆 + 晃头 + 腮红 + 汗）
 *   xlong   10min（红温 + 蒸汽 + 更快晃头 + 汗）
 *   ready   就绪（慢摇 + 眨眼笑）
 * 高度随文本行（父级用 1em 驱动）。
 */
export type PigState = "idle" | "run" | "long" | "xlong" | "ready"

withDefaults(defineProps<{ state?: PigState }>(), { state: "idle" })
</script>

<style scoped>
.running-pig {
  display: block;
  flex: none;
  width: auto;
  height: 1em;
  overflow: visible;
}

.ear,
.head {
  fill: var(--mascot-body);
}

.snout {
  fill: var(--mascot-snout);
}

.eye {
  fill: var(--mascot-eye);
}

.glint {
  fill: var(--white);
}

.mouth,
.eye-closed {
  fill: none;
  stroke: var(--mascot-eye);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.tail {
  fill: none;
  stroke: var(--mascot-snout);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform-box: fill-box;
  transform-origin: 20% 100%;
}

.sweat {
  fill: var(--mascot-sweat);
}

.blush {
  fill: var(--mascot-snout);
}

.open-mouth {
  fill: var(--mascot-eye);
}

.zzz {
  fill: var(--mascot-eye);
  font: 700 18px/1 system-ui;
}

.steam path {
  fill: none;
  stroke: var(--white);
  stroke-width: 1.5;
  stroke-linecap: round;
  opacity: 0.7;
}

/* ============ keyframes ============ */

@keyframes breathe {
  0%,
  100% {
    transform: scale(1, 1);
  }

  50% {
    transform: scale(1.02, 0.98);
  }
}

@keyframes sway {
  0%,
  100% {
    transform: translateX(-3px) rotate(-2.4deg);
  }

  50% {
    transform: translateX(3px) rotate(2.4deg);
  }
}

@keyframes sway-fast {
  0%,
  100% {
    transform: translateX(-4px) rotate(-3.4deg);
  }

  50% {
    transform: translateX(4px) rotate(3.4deg);
  }
}

@keyframes head-shake {
  0%,
  100% {
    transform: rotate(-4deg);
  }

  50% {
    transform: rotate(4deg);
  }
}

@keyframes head-shake-fast {
  0%,
  100% {
    transform: rotate(-6deg);
  }

  50% {
    transform: rotate(6deg);
  }
}

@keyframes huff {
  0%,
  100% {
    transform: translateY(0);
  }

  40% {
    transform: translateY(-2px);
  }

  70% {
    transform: translateY(-0.6px);
  }
}

@keyframes ear-twitch {
  0%,
  84%,
  100% {
    transform: rotate(0);
  }

  88% {
    transform: rotate(-12deg);
  }

  92% {
    transform: rotate(4deg);
  }
}

@keyframes sweat-drop {
  0% {
    transform: translateY(0);
    opacity: 0;
  }

  18% {
    opacity: 1;
  }

  88% {
    transform: translateY(8px);
    opacity: 0;
  }

  100% {
    transform: translateY(8px);
    opacity: 0;
  }
}

@keyframes blink {
  0%,
  92%,
  100% {
    transform: scaleY(1);
  }

  96% {
    transform: scaleY(0.1);
  }
}

@keyframes tail-wag {
  0%,
  60%,
  100% {
    transform: rotate(0);
  }

  68% {
    transform: rotate(-16deg);
  }

  76% {
    transform: rotate(10deg);
  }

  84% {
    transform: rotate(-8deg);
  }

  92% {
    transform: rotate(4deg);
  }
}

@keyframes tail-wag-fast {
  0%,
  100% {
    transform: rotate(-14deg);
  }

  50% {
    transform: rotate(14deg);
  }
}

@keyframes zzz-float {
  0% {
    transform: translate(0, 0);
    opacity: 0;
  }

  20% {
    opacity: 0.9;
  }

  80% {
    opacity: 0.9;
  }

  100% {
    transform: translate(8px, -14px);
    opacity: 0;
  }
}

@keyframes blush-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.8;
  }

  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

@keyframes steam-rise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }

  30% {
    opacity: 0.8;
  }

  100% {
    transform: translateY(-14px);
    opacity: 0;
  }
}

/* ============ 状态机 ============ */

.g,
.ear-l,
.ear-r,
.eyes,
.sweat,
.blush {
  transform-box: fill-box;
}

.g {
  transform-origin: 50% 60%;
}

.ear-l {
  transform-origin: 61% 72%;
}

.ear-r {
  transform-origin: 39% 72%;
}

.eyes {
  transform-origin: 50% 50%;
}

.sweat,
.blush {
  transform-origin: 50% 50%;
}

.idle .g {
  animation: breathe 3.2s var(--ease-in-out) infinite;
}

.run .g {
  animation: sway 0.55s var(--ease-in-out) infinite;
}

.long .g {
  animation:
    sway 0.5s var(--ease-in-out) infinite,
    head-shake 0.5s var(--ease-in-out) infinite;
}

.xlong .g {
  animation:
    sway-fast 0.32s var(--ease-in-out) infinite,
    head-shake-fast 0.32s var(--ease-in-out) infinite,
    huff 0.32s var(--ease-in-out) infinite;
}

.ready .g {
  animation: sway 1s var(--ease-in-out) infinite;
}

.idle .ear-r {
  animation: ear-twitch 4s linear infinite;
}

.long .sweat,
.xlong .sweat {
  animation: sweat-drop 0.9s linear infinite;
}

.long .sweat-2,
.xlong .sweat-2 {
  animation-delay: -0.45s;
}

.ready .eyes {
  animation: blink 3.4s linear infinite;
}

.idle .tail {
  animation: tail-wag 3.6s var(--ease-in-out) infinite;
}

.run .tail {
  animation: tail-wag-fast 0.55s var(--ease-in-out) infinite;
}

.long .tail {
  animation: tail-wag-fast 0.5s var(--ease-in-out) infinite;
}

.xlong .tail {
  animation: tail-wag-fast 0.32s var(--ease-in-out) infinite;
}

.ready .tail {
  animation: tail-wag 1.6s var(--ease-in-out) infinite;
}

.zzz-on .zzz-1 {
  animation: zzz-float 3s linear infinite;
}

.zzz-on .zzz-2 {
  font-size: 14px;
  animation: zzz-float 3s linear -1.5s infinite;
}

.long .blush {
  opacity: 0.8;
  animation: blush-pulse 0.6s var(--ease-in-out) infinite;
}

.xlong .head,
.xlong .ear {
  fill: var(--mascot-heat);
}

.xlong .snout {
  fill: var(--mascot-heat-snout);
}

.xlong .steam path {
  animation: steam-rise 1.1s linear infinite;
  opacity: 0;
}

.xlong .steam path:nth-child(2) {
  animation-delay: -0.36s;
}

.xlong .steam path:nth-child(3) {
  animation-delay: -0.72s;
}

@media (prefers-reduced-motion: reduce) {
  .running-pig * {
    animation: none !important;
  }
}
</style>
