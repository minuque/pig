import { spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const gateway = join(root, "packages/gateway");
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status) throw new Error(`${command} failed`);
};

if (process.argv[2] === "restore") {
  process.exit();
}

const temp = await mkdtemp(join(tmpdir(), "nono-package-"));
try {
  run("pnpm", ["--filter", "@pig/web", "build"]);
  await rm(join(gateway, "dist"), { recursive: true, force: true });
  await rm(join(gateway, "web"), { recursive: true, force: true });
  await cp(join(root, "apps/web/dist"), join(gateway, "web"), { recursive: true });

  const posix = (path) => path.replaceAll("\\", "/");
  const gatewayConfig = join(temp, "gateway.json");
  await writeFile(
    gatewayConfig,
    JSON.stringify({
      extends: posix(join(gateway, "tsconfig.json")),
      compilerOptions: {
        noEmit: false,
        rootDir: posix(join(gateway, "src")),
        outDir: posix(join(gateway, "dist")),
        // 发布 exports 指向 dist 的 .d.ts，声明必须生成
        declaration: true,
        declarationMap: false,
        sourceMap: false,
      },
      include: [posix(join(gateway, "src/**/*.ts"))],
    }),
  );
  run("pnpm", ["exec", "tsc", "-p", gatewayConfig]);
} finally {
  await rm(temp, { recursive: true, force: true });
}
