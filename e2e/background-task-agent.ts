import { writeFile } from "node:fs/promises"
import { join } from "node:path"

export const BG_TASK_TITLE = "开发服务器"
export const BG_FAIL_TITLE = "会失败的构建"
export const BG_AGENT_TITLE = "后台侦察"

/**
 * /bg 起一个一直输出的命令，/bg-fail 起一个马上以非零码退出的命令，/bg-agent 登记一个在跑的代理任务。
 * 都走内置 tasks 扩展的登记表，只是不经模型的工具调用。
 */
export async function writeBackgroundTaskExtension(agentDir: string, root: string) {
  const tasks = join(root, "packages/extensions/src/tasks").replaceAll("\\", "/")
  const environment = join(root, "packages/environment/src/index.ts").replaceAll("\\", "/")

  await writeFile(
    join(agentDir, "extensions", "bg.ts"),
    `import { startBashTask } from "${tasks}/bash.ts"
    import { taskConfig } from "${tasks}/config.ts"
    import { registryFor } from "${tasks}/registry.ts"
    import { environmentFor } from "${environment}"

    export default function (pi) {
      const start = (description, command) => (_args, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId()
        startBashTask(registryFor(sessionId), taskConfig, {
          sessionId,
          env: environmentFor("local"),
          cwd: ctx.cwd,
          command,
          description,
        })
      }
      pi.registerCommand("bg", {
        description: "bg",
        handler: start("${BG_TASK_TITLE}", "seq 1 200; while true; do echo tick; sleep 0.2; done"),
      })
      pi.registerCommand("bg-fail", {
        description: "bg-fail",
        handler: start("${BG_FAIL_TITLE}", "echo boom; exit 3"),
      })
      pi.registerCommand("bg-agent", {
        description: "bg-agent",
        handler: async (_args, ctx) => {
          const task = { id: "agent:e2e:0", kind: "agent", description: "${BG_AGENT_TITLE}", prompt: "看协议", status: "running", startedAt: Date.now(), steps: [], tokens: 0 }
          registryFor(ctx.sessionManager.getSessionId()).add(task, () => undefined)
        },
      })
    }`,
  )
}
