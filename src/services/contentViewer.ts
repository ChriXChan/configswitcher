import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

export class ContentViewer {
  public async readText(filePath?: string): Promise<string> {
    if (!filePath) {
      return "未找到对应文件。";
    }

    const content = await readFile(filePath, "utf8");
    return this.withLineNumbers(content);
  }

  public readTextSync(filePath?: string): string {
    if (!filePath) {
      return "未找到对应文件。";
    }

    const content = readFileSync(filePath, "utf8");
    return this.withLineNumbers(content);
  }

  public readRawTextSync(filePath?: string): string {
    if (!filePath) {
      return "";
    }

    return readFileSync(filePath, "utf8");
  }

  public formatComparedText(currentText: string, otherText: string): string {
    const currentLines = currentText.split(/\r?\n/);
    const otherLines = otherText.split(/\r?\n/);
    const lineCount = Math.max(currentLines.length, otherLines.length, 1);
    const width = String(lineCount).length;
    const output: string[] = [];

    for (let index = 0; index < lineCount; index += 1) {
      const currentLine = currentLines[index] ?? "";
      const otherLine = otherLines[index] ?? "";
      const isDifferent = currentLine !== otherLine;
      const lineText = `${String(index + 1).padStart(width, " ")} | ${this.escapeTags(currentLine)}`;

      output.push(
        isDifferent
          ? `{black-fg}{yellow-bg}${lineText}{/yellow-bg}{/black-fg}`
          : lineText,
      );
    }

    return output.join("\n");
  }

  private escapeTags(text: string): string {
    return text.replaceAll("{", "{open}");
  }

  private withLineNumbers(content: string): string {
    const lines = content.split(/\r?\n/);
    const width = String(lines.length).length;

    return lines
      .map((line, index) => `${String(index + 1).padStart(width, " ")} | ${line}`)
      .join("\n");
  }
}
