import test from "node:test";
import assert from "node:assert/strict";

import { SwitchExecutor } from "./switchExecutor";
import { SwitchPlan } from "../models/types";

class FakeFileOperator {
  private readonly files = new Map<string, string>();
  private readonly failCopies = new Set<string>();
  private readonly directories = new Set<string>();

  public constructor(existingFiles: Record<string, string>, failCopies: string[] = []) {
    Object.entries(existingFiles).forEach(([filePath, content]) => {
      this.files.set(filePath, content);
    });
    failCopies.forEach((filePath) => this.failCopies.add(filePath));
  }

  public async exists(filePath: string): Promise<boolean> {
    return this.files.has(filePath);
  }

  public async rename(): Promise<void> {
    throw new Error("rename should not be used in content swap mode");
  }

  public async copy(from: string, to: string): Promise<void> {
    const content = this.files.get(from);
    if (content === undefined) {
      throw new Error(`ENOENT: ${from}`);
    }

    if (this.failCopies.has(to)) {
      throw new Error(`EFAIL: ${to}`);
    }

    this.files.set(to, content);
  }

  public async remove(filePath: string): Promise<void> {
    this.files.delete(filePath);
    this.directories.delete(filePath);
  }

  public async ensureDirectory(directoryPath: string): Promise<void> {
    this.directories.add(directoryPath);
  }

  public read(filePath: string): string | undefined {
    return this.files.get(filePath);
  }

  public listFiles(): string[] {
    return Array.from(this.files.keys()).sort();
  }

  public listDirectories(): string[] {
    return Array.from(this.directories).sort();
  }
}

test("execute swaps file contents and keeps both files", async () => {
  const operator = new FakeFileOperator({
    "C:/tmp/auth.json": "ACTIVE",
    "C:/tmp/auth_2.json": "CANDIDATE",
  });

  const executor = new SwitchExecutor(operator);
  const plan: SwitchPlan = {
    directory: "C:/tmp",
    suffix: "auth_2.json",
    replaceMode: "swap",
    backupMode: { type: "auto" },
    issues: [],
    warnings: [],
    actions: [
      {
        kind: "swap",
        basename: "auth",
        from: "C:/tmp/auth.json",
        to: "C:/tmp/auth_2.json",
        description: "auth.json -> auth_2.json",
      },
      {
        kind: "swap",
        basename: "auth",
        from: "C:/tmp/auth_2.json",
        to: "C:/tmp/auth.json",
        description: "auth_2.json -> auth.json",
      },
    ],
  };

  const result = await executor.execute(plan);

  assert.equal(result.success, true);
  assert.equal(operator.read("C:/tmp/auth.json"), "CANDIDATE");
  assert.equal(operator.read("C:/tmp/auth_2.json"), "ACTIVE");
  assert.equal(
    operator.listFiles().some((filePath) => filePath.includes("change-config-temp")),
    false,
  );
  assert.equal(operator.listDirectories().length, 0);
});

test("execute copies candidate content into the active file and keeps candidate unchanged", async () => {
  const operator = new FakeFileOperator({
    "C:/tmp/auth.json": "ACTIVE",
    "C:/tmp/auth_2.json": "CANDIDATE",
  });

  const executor = new SwitchExecutor(operator);
  const plan: SwitchPlan = {
    directory: "C:/tmp",
    suffix: "auth_2.json",
    replaceMode: "copy",
    backupMode: { type: "auto" },
    issues: [],
    warnings: [],
    actions: [
      {
        kind: "copy",
        basename: "auth",
        from: "C:/tmp/auth_2.json",
        to: "C:/tmp/auth.json",
        description: "auth_2.json -> auth.json",
      },
    ],
  };

  const result = await executor.execute(plan);

  assert.equal(result.success, true);
  assert.equal(operator.read("C:/tmp/auth.json"), "CANDIDATE");
  assert.equal(operator.read("C:/tmp/auth_2.json"), "CANDIDATE");
  assert.equal(
    operator.listFiles().some((filePath) => filePath.includes("change-config-temp")),
    false,
  );
  assert.equal(operator.listDirectories().length, 0);
});

test("execute restores original contents when a target write fails", async () => {
  const operator = new FakeFileOperator(
    {
      "C:/tmp/auth.json": "ACTIVE",
      "C:/tmp/auth_2.json": "CANDIDATE",
      "C:/tmp/config.toml": "CONFIG_ACTIVE",
      "C:/tmp/config_2.toml": "CONFIG_CANDIDATE",
    },
    ["C:/tmp/config.toml"],
  );

  const executor = new SwitchExecutor(operator);
  const plan: SwitchPlan = {
    directory: "C:/tmp",
    suffix: "bundle",
    replaceMode: "swap",
    backupMode: { type: "auto" },
    issues: [],
    warnings: [],
    actions: [
      {
        kind: "swap",
        basename: "auth",
        from: "C:/tmp/auth.json",
        to: "C:/tmp/auth_2.json",
        description: "auth.json -> auth_2.json",
      },
      {
        kind: "swap",
        basename: "auth",
        from: "C:/tmp/auth_2.json",
        to: "C:/tmp/auth.json",
        description: "auth_2.json -> auth.json",
      },
      {
        kind: "swap",
        basename: "config",
        from: "C:/tmp/config.toml",
        to: "C:/tmp/config_2.toml",
        description: "config.toml -> config_2.toml",
      },
      {
        kind: "swap",
        basename: "config",
        from: "C:/tmp/config_2.toml",
        to: "C:/tmp/config.toml",
        description: "config_2.toml -> config.toml",
      },
    ],
  };

  const result = await executor.execute(plan);

  assert.equal(result.success, false);
  assert.equal(operator.read("C:/tmp/auth.json"), "ACTIVE");
  assert.equal(operator.read("C:/tmp/auth_2.json"), "CANDIDATE");
  assert.equal(operator.read("C:/tmp/config.toml"), "CONFIG_ACTIVE");
  assert.equal(operator.read("C:/tmp/config_2.toml"), "CONFIG_CANDIDATE");
});
