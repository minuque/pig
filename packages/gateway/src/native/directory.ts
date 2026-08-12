import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const folderPickerScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
try {
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write((ConvertTo-Json -Compress -InputObject $dialog.SelectedPath))
  }
} finally {
  $dialog.Dispose()
}
`;

/** 目录选择平台端口：由 Browser platform 发起，Node Host 侧弹出本地文件夹选择器。 */
export interface DirectoryPort {
  selectDirectory(): Promise<string | undefined>;
}

export class NodeDirectoryPort implements DirectoryPort {
  async selectDirectory(): Promise<string | undefined> {
    if (process.platform !== "win32") {
      throw new Error("folder picker is only supported on Windows");
    }
    const { stdout } = await execFileAsync(
      "pwsh",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-Command", folderPickerScript],
      { encoding: "utf8", windowsHide: true },
    );
    if (!stdout.trim()) return undefined;
    const selected: unknown = JSON.parse(stdout);
    if (typeof selected !== "string" || !selected.trim()) throw new Error("invalid folder path");
    return selected;
  }
}
