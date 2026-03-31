import test from "node:test";
import assert from "node:assert/strict";

import { getReplaceModeLabel, getRestoredGroupIndex, getViewAfterExecution } from "./viewState";
import { CandidateGroup } from "../models/types";

test("getReplaceModeLabel returns current mode label", () => {
  assert.equal(getReplaceModeLabel("copy"), "单向复制");
  assert.equal(getReplaceModeLabel("swap"), "双向交换");
});

test("getViewAfterExecution keeps groups view on success and shows result on failure", () => {
  assert.equal(getViewAfterExecution(true), "groups");
  assert.equal(getViewAfterExecution(false), "result");
});

test("getRestoredGroupIndex keeps the current selection when the group still exists", () => {
  const groups: CandidateGroup[] = [
    { id: "group:a", label: "a", suffix: "a", entries: [], issues: [], isComplete: true, isExecutable: true },
    { id: "group:b", label: "b", suffix: "b", entries: [], issues: [], isComplete: true, isExecutable: true },
  ];

  assert.equal(getRestoredGroupIndex(groups, "group:b"), 1);
});

test("getRestoredGroupIndex falls back to the first group when the previous group is missing", () => {
  const groups: CandidateGroup[] = [
    { id: "group:a", label: "a", suffix: "a", entries: [], issues: [], isComplete: true, isExecutable: true },
    { id: "group:b", label: "b", suffix: "b", entries: [], issues: [], isComplete: true, isExecutable: true },
  ];

  assert.equal(getRestoredGroupIndex(groups, "group:c"), 0);
  assert.equal(getRestoredGroupIndex(groups), 0);
});

test("getRestoredGroupIndex selects the first current-matching group on first entry", () => {
  const groups: CandidateGroup[] = [
    { id: "group:a", label: "a", suffix: "a", entries: [], issues: [], isComplete: true, isExecutable: true },
    { id: "group:b", label: "b", suffix: "b", entries: [], issues: [], isComplete: true, isExecutable: true },
    { id: "group:c", label: "c", suffix: "c", entries: [], issues: [], isComplete: true, isExecutable: true },
  ];

  assert.equal(getRestoredGroupIndex(groups, undefined, (group) => group.id === "group:b"), 1);
});
