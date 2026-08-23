import { describe, expect, it } from "vitest";
import {
  imageFilesFrom,
  roomForAttachments,
} from "@features/chat-input/hooks/use-composer-attachments.js";

function file(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("imageFilesFrom", () => {
  it("只收 image/*", () => {
    const files = imageFilesFrom([
      file("a.png", "image/png"),
      file("b.txt", "text/plain"),
      file("c.jpg", "image/jpeg"),
      file("d.json", "application/json"),
    ]);
    expect(files.map((item) => item.name)).toEqual(["a.png", "c.jpg"]);
  });

  it("空值与空列表返回空", () => {
    expect(imageFilesFrom(undefined)).toEqual([]);
    expect(imageFilesFrom(null)).toEqual([]);
    expect(imageFilesFrom([])).toEqual([]);
  });
});

describe("roomForAttachments", () => {
  it("空槽按上限截断", () => {
    expect(roomForAttachments(0, 3)).toBe(3);
    expect(roomForAttachments(0, 8)).toBe(6);
  });

  it("已有张数占用名额", () => {
    expect(roomForAttachments(5, 3)).toBe(1);
    expect(roomForAttachments(6, 1)).toBe(0);
    expect(roomForAttachments(4, 0)).toBe(0);
  });
});
