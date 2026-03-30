import test from "node:test";
import assert from "node:assert/strict";

import { getReplaceModeLabel, getViewAfterExecution } from "./viewState";

test("getReplaceModeLabel returns current mode label", () => {
  assert.equal(getReplaceModeLabel("copy"), "单向复制");
  assert.equal(getReplaceModeLabel("swap"), "双向交换");
});

test("getViewAfterExecution keeps groups view on success and shows result on failure", () => {
  assert.equal(getViewAfterExecution(true), "groups");
  assert.equal(getViewAfterExecution(false), "result");
});
