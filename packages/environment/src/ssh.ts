import {
  Client,
  type ClientChannel,
  type ConnectConfig,
  type FileEntryWithStats,
  type SFTPWrapper,
  type Stats,
} from "ssh2"

import { MAX_DEPTH, MAX_VISITED, SKIP_DIRS, rankEntries } from "./search.js"
import { connectConfig } from "./ssh-config.js"
import type { DirEntry, Environment, ExecOptions, FileStat, SearchEntry } from "./types.js"

type Connection = { client: Client; sftp: SFTPWrapper }

/** SFTP 的「文件不存在」状态码。 */
const NO_SUCH_FILE = 2
/** POSIX shell 单引号转义。 */
export const quote = (value: string) => `'${value.replaceAll("'", String.raw`'\''`)}'`
const call = <T>(run: (done: (error: Error | null | undefined, value: T) => void) => void) =>
  new Promise<T>((resolve, reject) =>
    run((error, value) => (error ? reject(error) : resolve(value))),
  )

/** 一台 SSH 主机：一条长连接，命令走 exec，文件走 SFTP；断开后下次调用自动重连。 */
export class SshEnvironment implements Environment {
  readonly id: string
  private connection: Promise<Connection> | undefined

  constructor(
    readonly alias: string,
    private readonly resolveConfig: () => Promise<ConnectConfig> = () => connectConfig(alias),
  ) {
    this.id = `ssh://${alias}`
  }

  async exec(command: string, { cwd, onData, signal, timeout }: ExecOptions) {
    if (signal?.aborted) throw new Error("aborted")
    const { client } = await this.connect()
    const channel = await call<ClientChannel>((done) =>
      client.exec(`cd ${quote(cwd)} && ${command}`, done),
    )
    let timedOut = false
    const kill = () => {
      channel.signal("KILL")
      channel.close()
    }
    const timer = timeout
      ? setTimeout(() => {
          timedOut = true
          kill()
        }, timeout * 1000)
      : undefined

    signal?.addEventListener("abort", kill, { once: true })

    try {
      // 连接断开时 ssh2 会关闭全部通道，只是收不到退出码
      const exit = await new Promise<{ code: number | null } | undefined>((resolve) => {
        let status: { code: number | null } | undefined
        channel.on("data", onData)
        channel.stderr.on("data", onData)
        channel.on("exit", (code: number | null, signalName?: string) => {
          status = { code: code ?? (signalName ? 128 : 1) }
        })
        channel.on("close", () => resolve(status))
      })

      if (signal?.aborted) throw new Error("aborted")

      if (timedOut) throw new Error(`timeout:${timeout}`)

      if (!exit) throw new Error(`SSH connection to ${this.alias} was lost`)
      return { exitCode: exit.code }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener("abort", kill)
    }
  }

  async readFile(path: string) {
    const { sftp } = await this.connect()
    return call<Buffer>((done) => sftp.readFile(path, done))
  }

  async writeFile(path: string, content: string | Buffer) {
    const { sftp } = await this.connect()
    await call<void>((done) => sftp.writeFile(path, content, (error) => done(error, undefined)))
  }

  async mkdir(path: string) {
    await this.output(`mkdir -p ${quote(path)}`, "/")
  }

  async stat(path: string): Promise<FileStat | undefined> {
    const { sftp } = await this.connect()

    try {
      const info = await call<Stats>((done) => sftp.stat(path, done))
      const kind = info.isFile() ? "file" : info.isDirectory() ? "directory" : "other"
      return { kind, size: info.size, mtimeMs: info.mtime * 1000 }
    } catch (error) {
      if ((error as { code?: unknown }).code === NO_SUCH_FILE) return undefined
      throw error
    }
  }

  async readdir(path: string): Promise<DirEntry[]> {
    const { sftp } = await this.connect()
    const entries = await call<FileEntryWithStats[]>((done) => sftp.readdir(path, done))
    return entries.flatMap((entry): DirEntry[] => {
      if (entry.attrs.isDirectory()) return [{ name: entry.filename, kind: "directory" }]
      return entry.attrs.isFile() ? [{ name: entry.filename, kind: "file" }] : []
    })
  }

  /** 远端一次 find 列出候选，本地打分；逐目录走 SFTP 每层都要一次往返。 */
  async search(
    root: string,
    query: string,
    options: { limit?: number; signal?: AbortSignal | undefined } = {},
  ) {
    const text = await this.output(FIND_COMMAND, root, options.signal)
    return rankEntries(parseFindOutput(text), query, options.limit)
  }

  async home() {
    const { sftp } = await this.connect()
    return call<string>((done) => sftp.realpath(".", done))
  }

  async close() {
    const pending = this.connection
    this.connection = undefined
    const connection = await pending?.catch(() => undefined)
    connection?.client.end()
  }

  /** 跑一条命令并收集输出；退出码不看，搜索类命令被 head 截断时非零属正常。 */
  private async output(command: string, cwd: string, signal?: AbortSignal) {
    const chunks: Buffer[] = []
    await this.exec(command, {
      cwd,
      onData: (data) => chunks.push(data),
      ...(signal ? { signal } : {}),
    })
    return Buffer.concat(chunks).toString("utf8")
  }

  private connect(): Promise<Connection> {
    if (this.connection) return this.connection

    const pending: Promise<Connection> = this.open(() => {
      if (this.connection === pending) this.connection = undefined
    })

    this.connection = pending
    pending.catch(() => undefined)
    return pending
  }

  private async open(lost: () => void): Promise<Connection> {
    const config = await this.resolveConfig()
    const client = new Client()

    try {
      await new Promise<void>((resolve, reject) => {
        client.once("ready", resolve).once("error", reject).connect(config)
      })
      // 连上之后的错误与断开只让下次调用重连，不能让未处理的 error 打死进程
      client.on("error", lost).on("close", lost)
      const sftp = await call<SFTPWrapper>((done) => client.sftp(done))
      return { client, sftp }
    } catch (error) {
      lost()
      client.end()
      throw error
    }
  }
}

const prunedNames = [...SKIP_DIRS].map((name) => `-name ${quote(name)}`).join(" -o ")
/** 与本机遍历同规则：根下隐藏项只留 .pi，SKIP_DIRS 列出但不下探，目录带尾斜杠。 */
export const FIND_COMMAND = [
  `find . -mindepth 1 -maxdepth ${MAX_DEPTH + 1}`,
  String.raw`\( -path './.*' ! -path ./.pi ! -path './.pi/*' -prune \)`,
  String.raw`-o \( -type d \( ${prunedNames} \) -prune -exec printf '%s/\n' {} + \)`,
  String.raw`-o \( -type d -exec printf '%s/\n' {} + \)`,
  String.raw`-o \( -type f -print \)`,
  `2>/dev/null | head -n ${MAX_VISITED}`,
].join(" ")
/** find 输出转成相对路径条目。 */
export const parseFindOutput = (text: string) =>
  text.split("\n").flatMap((line): SearchEntry[] => {
    const path = line.replace(/^\.\//, "")
    return path ? [{ path, kind: path.endsWith("/") ? "directory" : "file" }] : []
  })
