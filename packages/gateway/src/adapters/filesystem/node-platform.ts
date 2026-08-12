import { execFile } from "child_process";
import { realpath } from "fs/promises";
import { resolve } from "path";
import { promisify } from "util";
import type { PlatformPort } from "@pig/contracts";

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

export class NodePlatformPort implements PlatformPort {
  async selectWorkspaceDirectory(): Promise<string | undefined> {
    if (process.platform !== "win32") throw new Error("folder picker is only supported on Windows");
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

  async canonicalizeWorkspacePath(candidatePath: string): Promise<string> {
    return realpath(resolve(candidatePath));
  }
}
