import { cp, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { run } from "./run.mjs"

const root = resolve(import.meta.dirname, "..")
const gateway = join(root, "packages/gateway")
const temp = await mkdtemp(join(tmpdir(), "nono-package-"))

try {
  run("pnpm", ["--filter", "@pig/web", "build"], { cwd: root })
  await rm(join(gateway, "dist"), { recursive: true, force: true })
  await rm(join(gateway, "web"), { recursive: true, force: true })
  await cp(join(root, "apps/web/dist"), join(gateway, "web"), { recursive: true })

  const posix = (path) => path.replaceAll("\\", "/")
  const gatewayConfig = join(temp, "gateway.json")
  await writeFile(
    gatewayConfig,
    JSON.stringify({
      extends: posix(join(gateway, "tsconfig.json")),
      compilerOptions: {
        noEmit: false,
        rootDir: posix(join(gateway, "src")),
        outDir: posix(join(gateway, "dist")),
        // 临时 tsconfig 在系统临时目录，types 按配置所在目录解析，指回仓库根的 @types
        typeRoots: [posix(join(root, "node_modules/@types"))],
        // 发布 exports 指向 dist 的 .d.ts，声明必须生成
        declaration: true,
        declarationMap: false,
        sourceMap: false,
      },
      include: [posix(join(gateway, "src/**/*.ts"))],
    }),
  )
  run("pnpm", ["exec", "tsc", "-p", gatewayConfig], { cwd: root })
} finally {
  await rm(temp, { recursive: true, force: true })
}
