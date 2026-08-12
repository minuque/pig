import { afterEach, describe, expect, it } from "vitest";
import {
  LAST_CWD_KEY,
  LOCAL_WORKSPACES_KEY,
  loadLastCwd,
  loadLocalWorkspaces,
  parseLocalWorkspaces,
  saveLastCwd,
  saveLocalWorkspaces,
  type WorkspaceStorage,
} from "../src/client/workspace.js";

const STORAGE = new Map<string, string>();
const storage: WorkspaceStorage = {
  getItem: (key) => STORAGE.get(key) ?? null,
  setItem: (key, value) => void STORAGE.set(key, value),
};

afterEach(() => {
  STORAGE.clear();
});

describe("parseLocalWorkspaces", () => {
  it("returns an empty list for missing or invalid storage values", () => {
    expect(parseLocalWorkspaces(null)).toEqual([]);
    expect(parseLocalWorkspaces("not-json")).toEqual([]);
    expect(parseLocalWorkspaces('"str"')).toEqual([]);
  });
  it("keeps only non-empty strings", () => {
    expect(parseLocalWorkspaces('["/a", "", 42, "/b"]')).toEqual(["/a", "/b"]);
  });
});

describe("local workspace preference persistence", () => {
  it("round-trips the workspace list and last cwd", () => {
    saveLocalWorkspaces(["/a", "/b"], storage);
    saveLastCwd("/a", storage);
    expect(STORAGE.get(LOCAL_WORKSPACES_KEY)).toBe('["/a","/b"]');
    expect(loadLocalWorkspaces(storage)).toEqual(["/a", "/b"]);
    expect(loadLastCwd(storage)).toBe("/a");
  });
  it("treats corrupt values as empty", () => {
    STORAGE.set(LOCAL_WORKSPACES_KEY, "{broken");
    STORAGE.set(LAST_CWD_KEY, "x");
    expect(loadLocalWorkspaces(storage)).toEqual([]);
  });
});
