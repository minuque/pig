<template>
  <svg
    ref="mascot"
    class="hero-mascot"
    viewBox="-10 0 148 102"
    width="148"
    height="102"
    aria-hidden="true"
  >
    <g class="mascot-breathe">
      <path
        class="tail mascot-tail"
        d="M114 97H123C126 97 129 96 130.5 93.5C132 91 131.5 88 129 87.5C126.5 87 125 90 126.5 92.5C128 95 132 95.5 134.5 93.5C135.5 92.7 136 91.5 136.2 90"
      />

      <path
        class="ear mascot-ear-left"
        d="M40 24L42 14.5C37 9.5 27 3.5 21 3.8 16.5 4 15 7 15 12c0 6 .5 14 3 22L24 46 46 34z"
      />

      <path
        class="ear mascot-ear-right"
        d="M88 24l-2-9.5c5-5 15-11 21-10.7 4.5.2 6 3.2 6 8.2 0 6-.5 14-3 22L104 46 82 34z"
      />

      <path class="head" d="M11.84 100.86a60 60 0 1 1 104.32 0z" />

      <g class="face">
        <ellipse class="snout" cx="64" cy="63.5" rx="17.14" ry="10.84" />
        <path class="mouth" d="M57.05 80.14q6.95 6 13.9 0" />

        <g class="eyes">
          <g class="mascot-blink" :class="{ 'is-blinking': blinking }" @animationend="onBlinkEnd">
            <ellipse class="eye" cx="41.56" cy="50.9" rx="5.04" ry="5.8" />
            <ellipse class="eye" cx="86.44" cy="50.9" rx="5.04" ry="5.8" />
            <circle class="glint" cx="42.06" cy="48.1" r="1.76" />
            <circle class="glint" cx="86.94" cy="48.1" r="1.76" />
          </g>
        </g>
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue"
import { useMascotGaze } from "@features/session-workbench/hooks/use-mascot-gaze.js"

const { blinking, onBlinkEnd } = useMascotGaze(useTemplateRef<SVGSVGElement>("mascot"))
</script>

<style scoped>
.hero-mascot {
  display: block;
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

.mouth {
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
}

.face {
  transform: translate(calc(var(--gaze-x, 0) * 4px), calc(var(--gaze-y, 0) * 3px));
}

.eyes {
  transform: translate(calc(var(--gaze-x, 0) * 3px), calc(var(--gaze-y, 0) * 2.5px));
}

/* 呼吸、眨眼、耳朵轻抖、尾巴摇摆 */
.mascot-breathe,
.mascot-blink,
.mascot-ear-left,
.mascot-ear-right,
.mascot-tail {
  transform-box: fill-box;
}

.mascot-breathe {
  transform-origin: 50% 100%;
  animation: mascot-breathe 4.2s var(--ease-in-out) infinite;
}

.mascot-blink {
  transform-origin: center;
}

/* 由脚本按随机间隔挂上，animationend 后摘掉 */
.mascot-blink.is-blinking {
  animation: mascot-blink 180ms var(--ease-in-out);
}

.mascot-ear-left {
  transform-origin: 61% 72%;
  animation: mascot-ear-left 6s var(--ease-in-out) infinite;
}

.mascot-ear-right {
  transform-origin: 39% 72%;
  animation: mascot-ear-right 6s var(--ease-in-out) 0.12s infinite;
}

.mascot-tail {
  transform-origin: 20% 100%;
  animation: mascot-tail 3.6s var(--ease-in-out) infinite;
}

@keyframes mascot-breathe {
  50% {
    transform: scale(1.02, 0.98);
  }
}

@keyframes mascot-blink {
  50% {
    transform: scaleY(0.1);
  }
}

@keyframes mascot-ear-left {
  0%,
  84%,
  100% {
    transform: none;
  }

  88% {
    transform: rotate(-12deg);
  }

  92% {
    transform: rotate(4deg);
  }
}

@keyframes mascot-ear-right {
  0%,
  84%,
  100% {
    transform: none;
  }

  88% {
    transform: rotate(12deg);
  }

  92% {
    transform: rotate(-4deg);
  }
}

@keyframes mascot-tail {
  0%,
  60%,
  100% {
    transform: none;
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

@media (prefers-reduced-motion: reduce) {
  .mascot-breathe,
  .mascot-blink,
  .mascot-ear-left,
  .mascot-ear-right,
  .mascot-tail {
    animation: none;
  }
}
</style>
