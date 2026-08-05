import { describe, expect, it } from "vitest";
import type { Attachment } from "../src/components/composer/use-attachments.js";
import {
  attachmentFromFile,
  composeAttachmentText,
} from "../src/components/composer/use-attachments.js";

const att = (name: string, kind: Attachment["kind"]): Attachment => ({ id: 1, name, kind });

describe("composeAttachmentText", () => {
  it("正文后按行拼接每个附件名标记", () => {
    expect(composeAttachmentText("hello", [att("a.png", "image"), att("b.pdf", "file")])).toBe(
      "hello\n[附件: a.png]\n[附件: b.pdf]",
    );
  });

  it("无附件时仅返回去除首尾空白的正文", () => {
    expect(composeAttachmentText("  hi  ", [])).toBe("hi");
  });

  it("空正文仍保留附件标记行", () => {
    expect(composeAttachmentText("", [att("a.png", "image")])).toBe("[附件: a.png]");
  });
});

describe("attachmentFromFile", () => {
  it("image/* MIME 映射为图片附件", () => {
    expect(attachmentFromFile({ name: "x.png", type: "image/png" }, "file")).toEqual({
      name: "x.png",
      kind: "image",
    });
  });

  it("非图片文件沿用菜单选择的 fallback 类型", () => {
    expect(attachmentFromFile({ name: "x.pdf", type: "application/pdf" }, "file")).toEqual({
      name: "x.pdf",
      kind: "file",
    });
    expect(
      attachmentFromFile({ name: "x.bin", type: "application/octet-stream" }, "image"),
    ).toEqual({
      name: "x.bin",
      kind: "image",
    });
  });
});
