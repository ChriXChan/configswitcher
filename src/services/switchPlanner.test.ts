import test from "node:test";
import assert from "node:assert/strict";

import { SwitchPlanner } from "./switchPlanner";
import { ScanResult } from "../models/types";

function createScanResult(): ScanResult {
  return {
    directory: "C:/tmp",
    basenames: ["auth"],
    basenameScans: [],
    issues: [],
    groups: [
      {
        id: "auth:auth_2.json",
        label: "auth_2.json",
        suffix: "_2",
        issues: [],
        isComplete: true,
        isExecutable: true,
        entries: [
          {
            basename: "auth",
            issues: [],
            activeFile: {
              basename: "auth",
              extension: ".json",
              fullName: "auth.json",
              path: "C:/tmp/auth.json",
            },
            candidateFile: {
              basename: "auth",
              extension: ".json",
              fullName: "auth_2.json",
              path: "C:/tmp/auth_2.json",
            },
          },
        ],
      },
    ],
  };
}

test("createPlan creates copy actions in copy mode", async () => {
  const planner = new SwitchPlanner();

  const plan = await planner.createPlan(
    createScanResult(),
    "auth:auth_2.json",
    { type: "auto" },
    "copy",
  );

  assert.equal(plan.replaceMode, "copy");
  assert.deepEqual(plan.actions, [
    {
      kind: "copy",
      basename: "auth",
      from: "C:/tmp/auth_2.json",
      to: "C:/tmp/auth.json",
      description: "auth_2.json -> auth.json",
    },
  ]);
});

test("createPlan creates swap actions in swap mode", async () => {
  const planner = new SwitchPlanner();

  const plan = await planner.createPlan(
    createScanResult(),
    "auth:auth_2.json",
    { type: "auto" },
    "swap",
  );

  assert.equal(plan.replaceMode, "swap");
  assert.deepEqual(plan.actions, [
    {
      kind: "swap",
      basename: "auth",
      from: "C:/tmp/auth.json",
      to: "C:/tmp/auth_2.json",
      description: "auth.json -> auth_2.json",
    },
    {
      kind: "swap",
      basename: "auth",
      from: "C:/tmp/auth_2.json",
      to: "C:/tmp/auth.json",
      description: "auth_2.json -> auth.json",
    },
  ]);
});
