import {
  ExecutionLog,
  ExecutionResult,
  SwitchAction,
  SwitchPlan,
} from "../models/types";
import { FileOperator, NodeFileOperator, PlanValidator } from "./planValidator";

interface SnapshotRecord {
  originalPath: string;
  snapshotPath: string;
}

export class SwitchExecutor {
  private readonly validator: PlanValidator;

  public constructor(private readonly fileOperator: FileOperator = new NodeFileOperator()) {
    this.validator = new PlanValidator(fileOperator);
  }

  public async execute(plan: SwitchPlan): Promise<ExecutionResult> {
    const logs: ExecutionLog[] = [];
    const preflightError = await this.validator.validate(plan.actions);

    if (preflightError) {
      return {
        success: false,
        logs: [
          {
            action: plan.actions[0] ?? {
              kind: "copy",
              basename: "",
              from: "",
              to: "",
              description: "预检查",
            },
            stage: "execute",
            status: "failed",
            message: `预检查失败：${preflightError}`,
          },
        ],
        error: preflightError,
        rollbackAttempted: false,
        rollbackSucceeded: true,
      };
    }

    let snapshots: SnapshotRecord[] = [];
    const tempDirectory = this.createTempDirectory(plan.directory);

    try {
      snapshots = await this.createSnapshots(plan.actions, tempDirectory);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        logs: [
          {
            action: plan.actions[0] ?? {
              kind: "copy",
              basename: "",
              from: "",
              to: "",
              description: "创建快照",
            },
            stage: "execute",
            status: "failed",
            message: `创建快照失败：${message}`,
          },
        ],
        error: message,
        rollbackAttempted: false,
        rollbackSucceeded: true,
      };
    }

    for (const action of plan.actions) {
      try {
        const sourceExists = await this.fileOperator.exists(action.from);
        logs.push({
          action,
          stage: "execute",
          status: sourceExists ? "success" : "failed",
          message: `提交前源文件检查：${action.from} ${sourceExists ? "存在" : "不存在"}`,
        });

        if (!sourceExists) {
          throw new Error(`提交阶段源文件不存在：${action.from}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logs.push({
          action,
          stage: "execute",
          status: "failed",
          message: `${action.description} 失败：${message}`,
        });

        const rollbackLogs = await this.restoreFromSnapshots(snapshots, plan.actions);
        const rollbackSucceeded = rollbackLogs.every(
          (item) => item.status === "success",
        );

        logs.push(...rollbackLogs);
        await this.cleanupSnapshots(snapshots, tempDirectory);

        return {
          success: false,
          logs,
          error: message,
          rollbackAttempted: false,
          rollbackSucceeded,
        };
      }
    }

    for (const action of plan.actions) {
      try {
        const snapshot = snapshots.find((item) => item.originalPath === action.from);
        const snapshotPath = snapshot?.snapshotPath;
        const stagedExists = snapshotPath
          ? await this.fileOperator.exists(snapshotPath)
          : false;
        logs.push({
          action,
          stage: "execute",
          status: stagedExists ? "success" : "failed",
          message: `提交前检查：${snapshotPath ?? "未找到快照"} ${stagedExists ? "存在" : "不存在"}`,
        });

        if (!stagedExists) {
          throw new Error(`提交阶段快照不存在：${snapshotPath ?? action.from}`);
        }

        await this.fileOperator.copy(snapshotPath!, action.to);
        logs.push({
          action,
          stage: "execute",
          status: "success",
          message: action.description,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logs.push({
          action,
          stage: "execute",
          status: "failed",
          message: `${action.description} 失败：${message}`,
        });

        const rollbackLogs = await this.restoreFromSnapshots(snapshots, plan.actions);
        const rollbackSucceeded = rollbackLogs.every(
          (item) => item.status === "success",
        );

        logs.push(...rollbackLogs);
        await this.cleanupSnapshots(snapshots, tempDirectory);

        return {
          success: false,
          logs,
          error: message,
          rollbackAttempted: true,
          rollbackSucceeded,
        };
      }
    }

    await this.cleanupSnapshots(snapshots, tempDirectory);

    return {
      success: true,
      logs,
      rollbackAttempted: false,
      rollbackSucceeded: true,
    };
  }

  private async createSnapshots(
    actions: SwitchAction[],
    tempDirectory: string,
  ): Promise<SnapshotRecord[]> {
    const snapshots: SnapshotRecord[] = [];
    const seenPaths = new Set<string>();

    try {
      await this.fileOperator.ensureDirectory(tempDirectory);
      for (let index = 0; index < actions.length; index += 1) {
        const action = actions[index];
        for (const targetPath of [action.from, action.to]) {
          if (seenPaths.has(targetPath) || !(await this.fileOperator.exists(targetPath))) {
            continue;
          }

          seenPaths.add(targetPath);
          const snapshotPath = this.createSnapshotPath(
            tempDirectory,
            targetPath,
            snapshots.length,
          );
          await this.fileOperator.copy(targetPath, snapshotPath);
          snapshots.push({
            originalPath: targetPath,
            snapshotPath,
          });
        }
      }
    } catch (error) {
      await this.cleanupSnapshots(snapshots, tempDirectory);
      throw error;
    }

    return snapshots;
  }

  private async restoreFromSnapshots(
    snapshots: SnapshotRecord[],
    actions: SwitchAction[],
  ): Promise<ExecutionLog[]> {
    const logs: ExecutionLog[] = [];

    for (const snapshot of snapshots) {
      try {
        await this.fileOperator.copy(snapshot.snapshotPath, snapshot.originalPath);
        logs.push({
          action:
            actions.find(
              (action) => action.from === snapshot.originalPath || action.to === snapshot.originalPath,
            ) ?? {
            kind: "copy",
            basename: "",
            from: snapshot.originalPath,
            to: snapshot.originalPath,
            description: `恢复 ${snapshot.originalPath}`,
          },
          stage: "rollback",
          status: "success",
          message: `已恢复：${snapshot.originalPath}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logs.push({
          action:
            actions.find(
              (action) => action.from === snapshot.originalPath || action.to === snapshot.originalPath,
            ) ?? {
            kind: "copy",
            basename: "",
            from: snapshot.originalPath,
            to: snapshot.originalPath,
            description: `恢复 ${snapshot.originalPath}`,
          },
          stage: "rollback",
          status: "failed",
          message: `恢复失败：${snapshot.originalPath}，原因：${message}`,
        });
      }
    }

    return logs;
  }

  private createTempDirectory(directory: string): string {
    return `${directory}\\change-config-temp-${process.pid}-${Date.now()}`;
  }

  private createSnapshotPath(tempDirectory: string, sourcePath: string, index: number): string {
    const sourceFileName = sourcePath.split(/[\\/]/).pop() ?? `snapshot-${index}`;
    return `${tempDirectory}\\${index}-${sourceFileName}`;
  }

  private async cleanupSnapshots(snapshots: SnapshotRecord[], tempDirectory: string): Promise<void> {
    for (const snapshot of snapshots) {
      await this.fileOperator.remove(snapshot.snapshotPath);
    }

    await this.fileOperator.remove(tempDirectory);
  }
}
