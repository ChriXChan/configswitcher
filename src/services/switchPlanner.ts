import { access } from "node:fs/promises";
import path from "node:path";

import {
  BackupMode,
  ReplaceMode,
  ScanResult,
  SwitchAction,
  SwitchPlan,
} from "../models/types";

export class SwitchPlanner {
  public async createPlan(
    scanResult: ScanResult,
    groupId: string,
    backupMode: BackupMode,
    replaceMode: ReplaceMode,
  ): Promise<SwitchPlan> {
    const group = scanResult.groups.find((item) => item.id === groupId);
    const issues: string[] = [];
    const warnings: string[] = [];
    const actions: SwitchAction[] = [];

    if (!group) {
      issues.push(`未找到对应的替换方案。`);
      return {
        directory: scanResult.directory,
        suffix: groupId,
        replaceMode,
        backupMode,
        actions,
        issues,
        warnings,
      };
    }

    group.issues.forEach((issue) => issues.push(issue));

    for (const entry of group.entries) {
      if (!entry.candidateFile) {
        issues.push(`[${entry.basename}] 缺少候选文件，无法生成切换计划。`);
        continue;
      }

      const formalTarget =
        entry.activeFile?.path ??
        path.join(scanResult.directory, `${entry.basename}${entry.candidateFile.extension}`);

      if (replaceMode === "swap" && entry.activeFile) {
        actions.push({
          kind: "swap",
          basename: entry.basename,
          from: entry.activeFile.path,
          to: entry.candidateFile.path,
          description: `${entry.activeFile.fullName} -> ${entry.candidateFile.fullName}`,
        });
      }

      actions.push({
        kind: replaceMode,
        basename: entry.basename,
        from: entry.candidateFile.path,
        to: formalTarget,
        description: `${entry.candidateFile.fullName} -> ${path.basename(formalTarget)}`,
      });
    }

    if (!group.isExecutable) {
      issues.push("该候选组存在未解决问题，无法执行切换。");
    }

    if (issues.length > 0) {
      return {
        directory: scanResult.directory,
        suffix: group.label,
        replaceMode,
        backupMode,
        actions: [],
        issues,
        warnings,
      };
    }

    return {
      directory: scanResult.directory,
      suffix: group.label,
      replaceMode,
      backupMode,
      actions,
      issues,
      warnings,
    };
  }
}
