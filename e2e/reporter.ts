import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const latestDir = resolve(root, "e2e-report/latest");

type Shot = { name: string; body: Buffer };

function gitShortSha() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function shotFileName(name: string) {
  return name.endsWith(".png") ? name : `${name}.png`;
}

class E2eReporter implements Reporter {
  private shots: Shot[] = [];
  private axeJson = "[]";
  private failed: string[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== "passed" && result.status !== "skipped") {
      this.failed.push(test.title);
    }
    for (const attachment of result.attachments) {
      if (attachment.name === "axe.json" && attachment.body) {
        this.axeJson = attachment.body.toString("utf8");
      }
      if (
        attachment.contentType === "image/png" &&
        /^\d{2}-/.test(attachment.name) &&
        attachment.body
      ) {
        this.shots.push({ name: attachment.name, body: attachment.body });
      }
    }
  }

  async onEnd(result: FullResult) {
    await mkdir(latestDir, { recursive: true });
    const status = this.failed.length === 0 && result.status === "passed" ? "pass" : "fail";
    const sha = gitShortSha();
    const when = new Date().toISOString();
    const rows = this.shots.map(
      (shot) => `| ${shot.name} | ${status === "pass" ? "pass" : "见测试结果"} |`,
    );
    let axeSection = "serious/critical: 无法解析";
    try {
      const violations = JSON.parse(this.axeJson) as unknown[];
      axeSection =
        violations.length === 0
          ? "serious/critical: 0"
          : `serious/critical: ${violations.length}\n\n\`\`\`json\n${JSON.stringify(violations, null, 2)}\n\`\`\``;
    } catch {
      /* keep fallback */
    }
    const images = this.shots
      .map((shot) => `## ${shot.name}\n\n![](${shotFileName(shot.name)})\n`)
      .join("\n");
    const failBlock =
      this.failed.length === 0
        ? ""
        : `\n## 失败\n\n${this.failed.map((title) => `- ${title}`).join("\n")}\n\n调试报告：\`npx playwright show-report\`\n`;
    const report = `# pig UI 验收  ${status}  ${sha}  ${when}  1280×800 / 390×844  production SPA

| 检查点 | 结果 |
| --- | --- |
${rows.join("\n") || "| （无截图） | |"}

${images}
## axe

${axeSection}
${failBlock}`;
    await writeFile(resolve(latestDir, "report.md"), report, "utf8");
    await writeFile(resolve(latestDir, "axe.json"), this.axeJson, "utf8");
    await writeFile(
      resolve(latestDir, "meta.json"),
      JSON.stringify(
        {
          status,
          sha,
          when,
          failed: this.failed,
          playwrightStatus: result.status,
        },
        null,
        2,
      ),
      "utf8",
    );
    for (const shot of this.shots) {
      await writeFile(resolve(latestDir, shotFileName(shot.name)), shot.body);
    }
    console.log(`验收报告: e2e-report/latest/report.md`);
    console.log(`调试报告: npx playwright show-report`);
  }
}

export default E2eReporter;
