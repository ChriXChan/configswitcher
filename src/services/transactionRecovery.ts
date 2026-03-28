import { copyFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const SNAPSHOT_PATTERN = /\.change-config-snapshot-\d+-\d+-\d+$/;
const STAGING_PATTERN = /\.change-config-staging-\d+-\d+-\d+$/;

export interface RecoveryResult {
  restoredSources: string[];
  removedStagingFiles: string[];
  removedSnapshotFiles: string[];
}

export class TransactionRecovery {
  public async recoverDirectory(directory: string): Promise<RecoveryResult> {
    const entries = await readdir(directory, { withFileTypes: true });
    const restoredSources: string[] = [];
    const removedStagingFiles: string[] = [];
    const removedSnapshotFiles: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const fullPath = path.join(directory, entry.name);

      if (SNAPSHOT_PATTERN.test(entry.name)) {
        const sourcePath = fullPath.replace(SNAPSHOT_PATTERN, "");
        await copyFile(fullPath, sourcePath);
        await rm(fullPath, { force: true });
        restoredSources.push(sourcePath);
        removedSnapshotFiles.push(fullPath);
        continue;
      }

      if (STAGING_PATTERN.test(entry.name)) {
        await rm(fullPath, { force: true });
        removedStagingFiles.push(fullPath);
      }
    }

    return {
      restoredSources,
      removedStagingFiles,
      removedSnapshotFiles,
    };
  }
}
