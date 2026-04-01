import test from "node:test";
import assert from "node:assert/strict";

import { createExclusiveShortcutHandler } from "./shortcutGuard";

test("createExclusiveShortcutHandler ignores re-entrant calls while the handler is still running", async () => {
  let callCount = 0;
  let release: (() => void) | undefined;

  const handler = createExclusiveShortcutHandler(async () => {
    callCount += 1;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });

  const firstRun = handler();
  const secondRun = handler();

  assert.equal(callCount, 1);

  release?.();
  await Promise.all([firstRun, secondRun]);

  const thirdRun = handler();
  release?.();
  await thirdRun;
  assert.equal(callCount, 2);
});
