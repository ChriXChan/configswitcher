import { CandidateGroup, ReplaceMode } from "../models/types";

export type AppView = "groups" | "result";

export function getReplaceModeLabel(mode: ReplaceMode): string {
  return mode === "copy" ? "单向复制" : "双向交换";
}

export function getViewAfterExecution(success: boolean): AppView {
  return success ? "groups" : "result";
}

export function getRestoredGroupIndex(
  groups: CandidateGroup[],
  previousGroupId?: string,
  isCurrentMatch?: (group: CandidateGroup) => boolean,
): number {
  if (!previousGroupId) {
    const matchedCurrentIndex = isCurrentMatch
      ? groups.findIndex((group) => isCurrentMatch(group))
      : -1;

    return matchedCurrentIndex >= 0 ? matchedCurrentIndex : 0;
  }

  const matchedIndex = groups.findIndex((group) => group.id === previousGroupId);
  return matchedIndex >= 0 ? matchedIndex : 0;
}
