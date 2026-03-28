import { ScanResult } from "../models/types";

export class SelectionPlanner {
  public extractSelectedBasenames(
    scanResult: ScanResult,
    groupId: string,
    selectedBasenames: Set<string>,
  ): Set<string> {
    const group = scanResult.groups.find((item) => item.id === groupId);
    if (!group) {
      return new Set<string>();
    }

    return new Set(
      group.entries
        .map((entry) => entry.basename)
        .filter((basename) => selectedBasenames.has(basename)),
    );
  }

  public filterScanResult(
    scanResult: ScanResult,
    selectedBasenames: Set<string>,
  ): ScanResult {
    return {
      ...scanResult,
      basenames: scanResult.basenames.filter((basename) =>
        selectedBasenames.has(basename),
      ),
      basenameScans: scanResult.basenameScans.filter((scan) =>
        selectedBasenames.has(scan.basename),
      ),
      groups: scanResult.groups.map((group) => {
        const entries = group.entries.filter((entry) =>
          selectedBasenames.has(entry.basename),
        );
        const issues = group.issues.filter((issue) =>
          this.referencesAnyBasename(issue, selectedBasenames),
        );

        return {
          ...group,
          entries,
          issues,
          isComplete: entries.every((entry) => entry.candidateFile),
          isExecutable: entries.every((entry) => entry.candidateFile) && issues.length === 0,
        };
      }),
      issues: scanResult.issues.filter((issue) =>
        this.referencesAnyBasename(issue, selectedBasenames),
      ),
    };
  }

  private referencesAnyBasename(issue: string, selectedBasenames: Set<string>): boolean {
    return Array.from(selectedBasenames).some((basename) =>
      issue.includes(`[${basename}]`),
    );
  }
}
