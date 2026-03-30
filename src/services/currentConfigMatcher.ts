import { CandidateGroup } from "../models/types";
import { ContentViewer } from "./contentViewer";

export class CurrentConfigMatcher {
  public constructor(private readonly viewer = new ContentViewer()) {}

  public matchesGroup(group: CandidateGroup): boolean {
    if (!group.isComplete || group.entries.length === 0) {
      return false;
    }

    return group.entries.every((entry) => {
      if (!entry.activeFile || !entry.candidateFile) {
        return false;
      }

      return (
        this.viewer.readRawTextSync(entry.activeFile.path) ===
        this.viewer.readRawTextSync(entry.candidateFile.path)
      );
    });
  }
}
