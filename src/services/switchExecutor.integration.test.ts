import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { SwitchExecutor } from "./switchExecutor";
import { SwitchPlan } from "../models/types";

test("real filesystem: execute swaps contents and removes temp directory", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "change-config-exec-"));

  try {
    const auth = path.join(tempDir, "auth.json");
    const auth2 = path.join(tempDir, "auth_2.json");
    await writeFile(auth, "ACTIVE", "utf8");
    await writeFile(auth2, "CANDIDATE", "utf8");

    const plan: SwitchPlan = {
      directory: tempDir,
      suffix: "auth_2.json",
      backupMode: { type: "auto" },
      issues: [],
      warnings: [],
      actions: [
        {
          kind: "swap",
          basename: "auth",
          from: auth,
          to: auth2,
          description: "auth.json -> auth_2.json",
        },
        {
          kind: "swap",
          basename: "auth",
          from: auth2,
          to: auth,
          description: "auth_2.json -> auth.json",
        },
      ],
    };

    const result = await new SwitchExecutor().execute(plan);

    assert.equal(result.success, true);
    assert.equal(await readFile(auth, "utf8"), "CANDIDATE");
    assert.equal(await readFile(auth2, "utf8"), "ACTIVE");
    assert.equal(
      (await readdir(tempDir)).some((name) => name.includes("change-config-temp")),
      false,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("real filesystem: missing source file returns failed result instead of throwing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "change-config-missing-"));

  try {
    const auth = path.join(tempDir, "auth.json");
    const auth2 = path.join(tempDir, "auth_2.json");
    await writeFile(auth, "ACTIVE", "utf8");

    const plan: SwitchPlan = {
      directory: tempDir,
      suffix: "auth_2.json",
      backupMode: { type: "auto" },
      issues: [],
      warnings: [],
      actions: [
        {
          kind: "swap",
          basename: "auth",
          from: auth,
          to: auth2,
          description: "auth.json -> auth_2.json",
        },
        {
          kind: "swap",
          basename: "auth",
          from: auth2,
          to: auth,
          description: "auth_2.json -> auth.json",
        },
      ],
    };

    const result = await new SwitchExecutor().execute(plan);

    assert.equal(result.success, false);
    assert.match(result.error ?? "", /源文件不存在|ENOENT/);
    assert.equal(await readFile(auth, "utf8"), "ACTIVE");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
