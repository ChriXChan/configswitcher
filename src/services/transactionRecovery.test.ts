import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { TransactionRecovery } from "./transactionRecovery";

test("recoverDirectory restores source files from snapshots and removes temp files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "change-config-recovery-"));

  try {
    const sourcePath = path.join(tempDir, "config.toml");
    const snapshotPath = `${sourcePath}.change-config-snapshot-1-2-3`;
    const stagingPath = `${sourcePath}.change-config-staging-1-2-3`;

    await writeFile(sourcePath, "BROKEN", "utf8");
    await writeFile(snapshotPath, "ORIGINAL", "utf8");
    await writeFile(stagingPath, "TEMP", "utf8");

    const recovery = new TransactionRecovery();
    const result = await recovery.recoverDirectory(tempDir);

    assert.deepEqual(result.restoredSources, [sourcePath]);
    assert.deepEqual(result.removedSnapshotFiles, [snapshotPath]);
    assert.deepEqual(result.removedStagingFiles, [stagingPath]);
    assert.equal(await readFile(sourcePath, "utf8"), "ORIGINAL");
    assert.deepEqual((await readdir(tempDir)).sort(), ["config.toml"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
