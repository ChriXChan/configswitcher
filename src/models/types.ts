export interface ConfigFile {
  basename: string;
  extension: string;
  fullName: string;
  path: string;
  suffix?: string;
}

export interface BasenameScan {
  basename: string;
  activeFile?: ConfigFile;
  candidateFiles: ConfigFile[];
  issues: string[];
}

export interface CandidateEntry {
  basename: string;
  activeFile?: ConfigFile;
  candidateFile?: ConfigFile;
  issues: string[];
}

export interface CandidateGroup {
  id: string;
  label: string;
  suffix: string;
  entries: CandidateEntry[];
  issues: string[];
  isComplete: boolean;
  isExecutable: boolean;
}

export interface ScanResult {
  directory: string;
  basenames: string[];
  basenameScans: BasenameScan[];
  groups: CandidateGroup[];
  issues: string[];
}

export type BackupMode =
  | { type: "auto" }
  | { type: "manual"; suffix: string };

export interface SwitchAction {
  kind: "swap";
  basename: string;
  from: string;
  to: string;
  description: string;
}

export interface SwitchPlan {
  directory: string;
  suffix: string;
  backupMode: BackupMode;
  actions: SwitchAction[];
  issues: string[];
  warnings: string[];
}

export interface ExecutionLog {
  action: SwitchAction;
  stage: "execute" | "rollback";
  status: "success" | "failed";
  message: string;
}

export interface ExecutionResult {
  success: boolean;
  logs: ExecutionLog[];
  error?: string;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
}
