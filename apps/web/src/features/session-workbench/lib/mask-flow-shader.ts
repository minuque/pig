/** 欢迎页「字符流光」：fbm 流动场按格取亮度，选 5x5 位图字形遮罩显示。 */
export const MASK_VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`
export const MASK_FRAG = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCell;
uniform float uGain;
uniform float uMask;
uniform vec3 uLow;
uniform vec3 uHigh;
out vec4 fragColor;

// " .:-=+*#@" 按 5x5 打包，第 0 位在左上
const int glyphs[9] = int[](
  0,
  1 << 22,
  (1 << 7) | (1 << 17),
  31 << 10,
  (31 << 5) | (31 << 15),
  (1 << 2) | (1 << 7) | (31 << 10) | (1 << 17) | (1 << 22),
  (1 << 0) | (1 << 2) | (1 << 4) | (1 << 6) | (1 << 7) | (1 << 8) | (31 << 10) | (1 << 16) | (1 << 17) | (1 << 18) | (1 << 20) | (1 << 22) | (1 << 24),
  (1 << 1) | (1 << 3) | (31 << 5) | (1 << 11) | (1 << 13) | (31 << 15) | (1 << 21) | (1 << 23),
  (1 << 25) - 1
);

float hash21(vec2 p) { return fract(sin(dot(p, vec2(27.1, 61.7))) * 43758.5453123); }

float noise(vec2 st) {
  vec2 i = floor(st), f = fract(st);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 st) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(st);
    st *= 2.02;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell) * uCell;
  vec2 uv = cell / uResolution;
  uv.x *= uResolution.x / uResolution.y;
  vec2 warp = vec2(fbm(uv * 2.0 + uTime * 0.1), fbm(uv * 2.0 - uTime * 0.1));
  float n = fbm(uv * 3.0 + warp + uTime * 0.35);
  // 选字用原作的绿蓝两色算亮度，换成主题色也不改字形分布
  float lum = dot(mix(vec3(0.05, 0.9, 0.4), vec3(0.15, 0.4, 1.0), n) * n, vec3(0.299, 0.587, 0.114));
  int glyph = glyphs[int(clamp(lum, 0.0, 0.999) * 9.0)];
  ivec2 grid = ivec2(fract(gl_FragCoord.xy / uCell) * 5.0);
  float lit = float((glyph >> ((4 - grid.y) * 5 + grid.x)) & 1);
  float a = clamp(lum * 1.4, 0.0, 1.0) * lit * uGain;
  // 留白中心对齐标题加输入框那组（列高 45% 处，gl 坐标自下而上）
  vec2 centered = (cell / uResolution - vec2(0.5, 0.55)) / vec2(0.3, 0.22);
  a *= mix(1.0, 0.12 + 0.88 * smoothstep(0.6, 1.2, length(centered)), uMask);
  fragColor = vec4(mix(uLow, uHigh, n) * a, a);
}`
