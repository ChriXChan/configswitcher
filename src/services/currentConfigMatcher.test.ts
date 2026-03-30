import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CurrentConfigMatcher } from "./currentConfigMatcher";
import { CandidateGroup } from "../models/types";

async function createGroupFixture(activeContent: string, candidateContent: string): Promise<CandidateGroup> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "change-config-matcher-"));
  const activePath = path.join(tempDir, "auth.json");
  const candidatePath = path.join(tempDir, "auth_cpa.json");

  await writeFile(activePath, activeContent, "utf8");
  await writeFile(candidatePath, candidateContent, "utf8");

  return {
    id: "auth:auth_cpa.json",
    label: "auth_cpa.json",
    suffix: "cpa",
    entries: [
      {
        basename: "auth",
        activeFile: {
          basename: "auth",
          extension: ".json",
          fullName: "auth.json",
          path: activePath,
        },
        candidateFile: {
          basename: "auth",
          extension: ".json",
          fullName: "auth_cpa.json",
          path: candidatePath,
        },
        issues: [],
      },
    ],
    issues: [],
    isComplete: true,
    isExecutable: true,
  };
}

test("matchesGroup returns true when every candidate file content equals the current file", async (t) => {
  const group = await createGroupFixture('{"mode":"same"}', '{"mode":"same"}');
  const matcher = new CurrentConfigMatcher();
  const fixtureDirectory = path.dirname(group.entries[0].activeFile!.path);

  t.after(async () => {
    await rm(fixtureDirectory, { recursive: true, force: true });
  });

  assert.equal(matcher.matchesGroup(group), true);
});

test("matchesGroup returns false when any candidate file content differs from the current file", async (t) => {
  const group = await createGroupFixture('{"mode":"active"}', '{"mode":"candidate"}');
  const matcher = new CurrentConfigMatcher();
  const fixtureDirectory = path.dirname(group.entries[0].activeFile!.path);

  t.after(async () => {
    await rm(fixtureDirectory, { recursive: true, force: true });
  });

  assert.equal(matcher.matchesGroup(group), false);
});
