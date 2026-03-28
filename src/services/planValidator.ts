import { access, copyFile, rm, rename } from "node:fs/promises";

import { SwitchAction } from "../models/types";

export interface FileOperator {
  exists(filePath: string): Promise<boolean>;
  rename(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  remove(filePath: string): Promise<void>;
  ensureDirectory(directoryPath: string): Promise<void>;
}

export class NodeFileOperator implements FileOperator {
  private static readonly COPY_RETRYABLE_ERROR_CODES = new Set(["EBUSY", "EPERM"]);

  public async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async rename(from: string, to: string): Promise<void> {
    await rename(from, to);
  }

  public async copy(from: string, to: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await copyFile(from, to);
        return;
      } catch (error) {
        lastError = error;
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";

        if (!NodeFileOperator.COPY_RETRYABLE_ERROR_CODES.has(code) || attempt === 3) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  public async remove(filePath: string): Promise<void> {
    await rm(filePath, { force: true, recursive: true });
  }

  public async ensureDirectory(directoryPath: string): Promise<void> {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(directoryPath, { recursive: true });
  }
}

export class PlanValidator {
  public constructor(private readonly fileOperator: FileOperator = new NodeFileOperator()) {}

  public async validate(actions: SwitchAction[]): Promise<string | undefined> {
    for (const action of actions) {
      if (!(await this.fileOperator.exists(action.from))) {
        return `${action.description} 的源文件不存在：${action.from}`;
      }
    }

    return undefined;
  }
}
