import { ReplaceMode } from "../models/types";

export type AppView = "groups" | "result";

export function getReplaceModeLabel(mode: ReplaceMode): string {
  return mode === "copy" ? "单向复制" : "双向交换";
}

export function getViewAfterExecution(success: boolean): AppView {
  return success ? "groups" : "result";
}
