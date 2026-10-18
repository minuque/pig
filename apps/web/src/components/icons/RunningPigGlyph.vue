<template>
  <svg
    class="running-pig"
    :class="{ idle }"
    viewBox="0 0 32 20"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g class="pig-bob">
      <path
        class="pig-tail"
        d="M4.4 10.5c-1.5-.4-2.4.5-2.3 1.6.1 1 .9 1.6 1.6 1.4.6-.1.9-.8.6-1.4"
      />
      <!-- 身体前倾：肩颈高于臀部，奔跑姿态 -->
      <path
        class="pig-body"
        d="M4.5 12.2c0-3.4 3.4-5.8 7.6-5.8 1.6 0 3.2.3 4.6.8l2.2-1c.5-.2 1 .1 1 .6v1.6l3.8.6c1 .2 1.6 1 1.6 1.9v1.6c0 1-.8 1.8-1.8 1.8l-2.4-.3c-1.8 1.9-4.7 3-8.2 3-4.5 0-8.4-2.7-8.4-6.8z"
      />
      <!-- 鼻端分界：口吻和脸的过渡线 -->
      <path class="pig-mouth" d="M20.4 11.5c1.5.5 3 .6 4.6.4" />

      <path
        class="pig-ear"
        d="M11.6 6.3c-.6-1.6-2-2.7-3.5-2.7-.7 0-1.1.6-.9 1.2.4 1 1.5 1.7 2.8 1.9z"
      />
      <!-- 鼻子横向椭圆，贴住头前端，像 mascot -->
      <ellipse class="pig-snout" cx="23" cy="10.4" rx="2" ry="1.7" />
      <ellipse class="pig-nostril" cx="24.1" cy="10.2" rx=".32" ry=".45" />
      <ellipse class="pig-nostril" cx="23.6" cy="11.1" rx=".3" ry=".42" />
      <circle class="pig-eye" cx="18.4" cy="8.4" r=".85" />
    </g>

    <g class="pig-legs">
      <path class="pig-leg pig-leg-front" d="M17.5 14.6l3.6 3.4" />
      <path class="pig-leg pig-leg-hind" d="M7.6 14.4l-3.4 3.2" />
    </g>
  </svg>
</template>

<script setup lang="ts">
/** 奔跑小猪：turn 状态指示器的动态图标，高度随文本行（父级用 1em 驱动）。 */
defineProps<{ idle?: boolean }>()
</script>

<style scoped>
.running-pig {
  display: block;
  flex: none;
  width: auto;
  height: 1em;
  overflow: visible;
  /* 画布默认朝右奔跑，镜像成朝左 */
  transform: scaleX(-1);
}

.pig-body,
.pig-ear {
  fill: var(--mascot-body);
}

.pig-snout {
  fill: var(--mascot-snout);
}

.pig-eye,
.pig-nostril {
  fill: var(--mascot-eye);
}

.pig-mouth {
  fill: none;
  stroke: var(--mascot-eye);
  stroke-width: 0.5;
  stroke-linecap: round;
  opacity: 0.55;
}

.pig-tail {
  fill: none;
  stroke: var(--mascot-snout);
  stroke-width: 1.5;
  stroke-linecap: round;
  transform-box: fill-box;
  transform-origin: 100% 0;
  animation: pig-tail-wag 0.72s var(--ease-in-out) infinite;
}

.pig-leg {
  fill: none;
  stroke: var(--mascot-body);
  stroke-width: 2;
  stroke-linecap: round;
  transform-box: fill-box;
  transform-origin: 50% 0;
  animation: pig-leg-run 0.42s var(--ease-in-out) infinite;
}

/* 前腿、后腿反相：迈大步 */
.pig-leg-hind {
  animation-delay: -0.21s;
}

.pig-bob {
  animation: pig-bob 0.42s var(--ease-in-out) infinite;
}

.idle .pig-bob,
.idle .pig-leg,
.idle .pig-tail {
  animation: none;
}

@keyframes pig-bob {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-1.2px);
  }
}

@keyframes pig-leg-run {
  0%,
  100% {
    transform: rotate(38deg);
  }

  50% {
    transform: rotate(-38deg);
  }
}

@keyframes pig-tail-wag {
  0%,
  100% {
    transform: rotate(0);
  }

  50% {
    transform: rotate(-24deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pig-bob,
  .pig-leg,
  .pig-tail {
    animation: none;
  }
}
</style>
