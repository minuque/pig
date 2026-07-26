import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const gatewayOrigin = process.env.NPNG_GATEWAY_ORIGIN;

/**
 * The packaged Gateway static server only assigns text/javascript and
 * text/html content types, so a linked stylesheet would be refused by the
 * browser. Inline the emitted CSS into index.html instead (the CSP already
 * allows inline styles) and drop the separate asset.
 */
function inlineCssForGateway(): Plugin {
  return {
    name: "npng-inline-css-for-gateway",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset") return;
      let source = String(html.source);
      for (const fileName of Object.keys(bundle)) {
        if (!fileName.endsWith(".css")) continue;
        const asset = bundle[fileName];
        if (!asset || asset.type !== "asset") continue;
        const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const link = new RegExp(`<link[^>]*href="/?${escaped}"[^>]*>\\s*`);
        if (!link.test(source)) continue;
        source = source.replace(
          link,
          `<style>${String(asset.source)}</style>\n  `,
        );
        delete bundle[fileName];
      }
      html.source = source;
    },
  };
}

export default defineConfig({
  plugins: [vue(), inlineCssForGateway()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@no-pi-no-gang/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
      "@no-pi-no-gang/testkit": fileURLToPath(
        new URL("../../packages/testkit/src/index.ts", import.meta.url),
      ),
    },
  },
  ...(gatewayOrigin
    ? { server: { proxy: { "/api": gatewayOrigin, "/health": gatewayOrigin } } }
    : {}),
  build: { target: "es2022" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
