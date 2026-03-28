import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  BasenameScan,
  CandidateEntry,
  CandidateGroup,
  ConfigFile,
  ScanResult,
} from "../models/types";

interface ParsedDirFile {
  extension: string;
  fullName: string;
  nameWithoutExtension: string;
  path: string;
}

interface CandidateNameParts {
  basename: string;
  suffix: string;
}

export class ConfigScanner {
  public async scan(directory: string, basenames: string[]): Promise<ScanResult> {
    const normalizedBasenames = this.normalizeBasenames(basenames);
    const issues: string[] = [];

    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map<ParsedDirFile>((entry) => {
        const parsed = path.parse(entry.name);

        return {
          extension: parsed.ext,
          fullName: entry.name,
          nameWithoutExtension: parsed.name,
          path: path.join(directory, entry.name),
        };
      });

    const basenameScans = normalizedBasenames.map((basename) =>
      this.scanBasename(basename, files),
    );

    if (normalizedBasenames.length === 0) {
      issues.push("请至少输入一个配置基名，例如 auth,config。");
    }

    const groups = this.buildGroups(basenameScans);

    if (groups.length === 0 && normalizedBasenames.length > 0) {
      issues.push("未找到任何候选配置组。候选文件名应类似 auth_me.json。");
    }

    basenameScans.forEach((scan) => {
      scan.issues.forEach((issue) => {
        issues.push(`[${scan.basename}] ${issue}`);
      });
    });

    return {
      directory,
      basenames: normalizedBasenames,
      basenameScans,
      groups,
      issues,
    };
  }

  public async inferBasenames(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const activeNames = new Set<string>();
    const candidateBaseNames = new Set<string>();

    entries
      .filter((entry) => entry.isFile())
      .forEach((entry) => {
        const parsed = path.parse(entry.name);
        const candidateParts = this.parseCandidateName(parsed.name);

        if (!candidateParts) {
          activeNames.add(parsed.name);
          return;
        }

        candidateBaseNames.add(candidateParts.basename);
      });

    return Array.from(activeNames)
      .filter((name) => candidateBaseNames.has(name))
      .sort((left, right) => left.localeCompare(right));
  }

  private normalizeBasenames(basenames: string[]): string[] {
    return Array.from(
      new Set(
        basenames
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );
  }

  private scanBasename(basename: string, files: ParsedDirFile[]): BasenameScan {
    const issues: string[] = [];
    const activeFiles = files.filter(
      (file) => file.nameWithoutExtension === basename,
    );
    const candidateFiles = files
      .map<ConfigFile | undefined>((file) => {
        const candidateParts = this.parseCandidateNameForBasename(
          file.nameWithoutExtension,
          basename,
        );

        if (!candidateParts) {
          return undefined;
        }

        return {
          basename,
          extension: file.extension,
          fullName: file.fullName,
          path: file.path,
          suffix: candidateParts.suffix,
        };
      })
      .filter((file): file is ConfigFile => Boolean(file));

    let activeFile: ConfigFile | undefined;

    if (activeFiles.length > 1) {
      issues.push(
        `发现多个正式文件：${activeFiles.map((file) => file.fullName).join(", ")}`,
      );
    } else if (activeFiles.length === 1) {
      activeFile = {
        basename,
        extension: activeFiles[0].extension,
        fullName: activeFiles[0].fullName,
        path: activeFiles[0].path,
      };
    }

    const duplicateSuffixes = new Map<string, ConfigFile[]>();
    candidateFiles.forEach((candidate) => {
      const suffix = candidate.suffix ?? "";
      const filesWithSameSuffix = duplicateSuffixes.get(suffix) ?? [];
      filesWithSameSuffix.push(candidate);
      duplicateSuffixes.set(suffix, filesWithSameSuffix);
    });

    duplicateSuffixes.forEach((filesWithSameSuffix, suffix) => {
      if (filesWithSameSuffix.length > 1) {
        issues.push(
          `候选后缀 ${suffix} 存在重复文件：${filesWithSameSuffix
            .map((file) => file.fullName)
            .join(", ")}`,
        );
      }
    });

    return {
      basename,
      activeFile,
      candidateFiles,
      issues,
    };
  }

  private buildGroups(basenameScans: BasenameScan[]): CandidateGroup[] {
    const groups: CandidateGroup[] = [];
    const usedCandidates = new Set<string>();
    const candidatesBySuffix = new Map<
      string,
      Array<{ scan: BasenameScan; candidate: ConfigFile }>
    >();

    basenameScans.forEach((scan) => {
      scan.candidateFiles.forEach((candidate) => {
        const suffix = candidate.suffix ?? "";
        const items = candidatesBySuffix.get(suffix) ?? [];
        items.push({ scan, candidate });
        candidatesBySuffix.set(suffix, items);
      });
    });

    Array.from(candidatesBySuffix.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([suffix, items]) => {
        const distinctBasenames = new Set(items.map((item) => item.scan.basename));
        if (distinctBasenames.size < 2) {
          return;
        }

        const entries = items.map(({ scan, candidate }) => {
          usedCandidates.add(candidate.path);
          return this.buildEntry(scan, candidate);
        });

        const issues = entries.flatMap((entry) =>
          entry.issues.map((issue) => `[${entry.basename}] ${issue}`),
        );

        groups.push({
          id: `group:${suffix}`,
          label: entries
            .map((entry) => entry.candidateFile?.fullName ?? `${entry.basename}(缺失)`)
            .join("  "),
          suffix,
          entries,
          issues,
          isComplete: entries.every((entry) => entry.candidateFile),
          isExecutable: entries.every((entry) => entry.candidateFile) && issues.length === 0,
        });
      });

    basenameScans.forEach((scan) => {
      scan.candidateFiles.forEach((candidate) => {
        if (usedCandidates.has(candidate.path)) {
          return;
        }

        groups.push(this.buildSingleCandidateGroup(scan, candidate));
      });
    });

    return groups.sort((left, right) => left.label.localeCompare(right.label));
  }

  private buildSingleCandidateGroup(
    scan: BasenameScan,
    candidateFile: ConfigFile,
  ): CandidateGroup {
    const entry = this.buildEntry(scan, candidateFile);
    const issues = entry.issues.map((issue) => `[${entry.basename}] ${issue}`);

    return {
      id: `${scan.basename}:${candidateFile.fullName}`,
      label: candidateFile.fullName,
      suffix: candidateFile.suffix ?? "",
      entries: [entry],
      issues,
      isComplete: Boolean(entry.candidateFile),
      isExecutable: Boolean(entry.candidateFile) && issues.length === 0,
    };
  }

  private buildEntry(scan: BasenameScan, candidateFile: ConfigFile): CandidateEntry {
    const entryIssues: string[] = [];

    if (
      scan.activeFile &&
      scan.activeFile.extension !== candidateFile.extension
    ) {
      entryIssues.push(
        `正式文件扩展名 ${scan.activeFile.extension} 与候选文件扩展名 ${candidateFile.extension} 不一致`,
      );
    }

    scan.issues.forEach((issue) => entryIssues.push(issue));

    return {
      basename: scan.basename,
      activeFile: scan.activeFile,
      candidateFile,
      issues: entryIssues,
    };
  }

  private parseCandidateName(nameWithoutExtension: string): CandidateNameParts | undefined {
    const separators = [" - ", "_"];

    for (const separator of separators) {
      const separatorIndex = nameWithoutExtension.indexOf(separator);
      if (separatorIndex <= 0) {
        continue;
      }

      const basename = nameWithoutExtension.slice(0, separatorIndex).trim();
      const suffix = nameWithoutExtension
        .slice(separatorIndex + separator.length)
        .trim();

      if (basename.length > 0 && suffix.length > 0) {
        return {
          basename,
          suffix,
        };
      }
    }

    return undefined;
  }

  private parseCandidateNameForBasename(
    nameWithoutExtension: string,
    basename: string,
  ): CandidateNameParts | undefined {
    if (!nameWithoutExtension.startsWith(basename) || nameWithoutExtension === basename) {
      return undefined;
    }

    const rawSuffix = nameWithoutExtension.slice(basename.length);
    const normalizedSuffix = rawSuffix.replace(/^[\s._-]+/, "").trim();
    const suffix = normalizedSuffix.length > 0 ? normalizedSuffix : rawSuffix.trim();

    if (suffix.length > 0) {
      return {
        basename,
        suffix,
      };
    }

    return undefined;
  }
}
