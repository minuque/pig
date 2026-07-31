import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const gateway = join(root, "packages/gateway");
const dependency = join(gateway, "node_modules/@no-pi-no-gang/contracts");
const backup = `${dependency}.workspace-link`;
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status) throw new Error(`${command} failed`);
};

if (process.argv[2] === "restore") {
  try {
    await lstat(backup);
    await rm(dependency, { recursive: true, force: true });
    await rename(backup, dependency);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  process.exit();
}

const temp = await mkdtemp(join(tmpdir(), "nono-package-"));
try {
  run("pnpm", ["--filter", "@no-pi-no-gang/web", "build"]);
  await rm(join(gateway, "dist"), { recursive: true, force: true });
  await rm(join(gateway, "web"), { recursive: true, force: true });
  await cp(join(root, "packages/web/dist"), join(gateway, "web"), { recursive: true });

  try {
    await lstat(backup);
  } catch {
    await mkdir(dirname(dependency), { recursive: true });
    await rename(dependency, backup);
  }
  await mkdir(dependency, { recursive: true });
  const contractsPackage = JSON.parse(
    await readFile(join(root, "packages/contracts/package.json"), "utf8"),
  );
  await writeFile(
    join(dependency, "package.json"),
    JSON.stringify({
      name: contractsPackage.name,
      version: contractsPackage.version,
      type: "module",
      main: "dist/index.js",
      types: "dist/index.d.ts",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      },
    }),
  );

  const posix = (path) => path.replaceAll("\\", "/");
  const contractsConfig = join(temp, "contracts.json");
  await writeFile(
    contractsConfig,
    JSON.stringify({
      extends: posix(join(root, "packages/contracts/tsconfig.json")),
      compilerOptions: {
        noEmit: false,
        outDir: posix(join(dependency, "dist")),
        declaration: true,
        declarationMap: false,
        sourceMap: false,
      },
    }),
  );
  run("pnpm", ["exec", "tsc", "-p", contractsConfig]);

  const gatewayConfig = join(temp, "gateway.json");
  await writeFile(
    gatewayConfig,
    JSON.stringify({
      extends: posix(join(gateway, "tsconfig.json")),
      compilerOptions: {
        noEmit: false,
        rootDir: posix(join(gateway, "src")),
        outDir: posix(join(gateway, "dist")),
        declaration: false,
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
