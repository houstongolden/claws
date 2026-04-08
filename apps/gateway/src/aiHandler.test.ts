import { describe, it } from "node:test";
import assert from "node:assert";
import { PLAN_MODE_TOOL_NAMES, defaultMaxSteps } from "./aiHandler.js";

describe("aiHandler policy", () => {
  it("PLAN_MODE_TOOL_NAMES excludes write tools", () => {
    assert.equal(PLAN_MODE_TOOL_NAMES.has("fs.write"), false);
    assert.equal(PLAN_MODE_TOOL_NAMES.has("fs.read"), true);
    assert.equal(PLAN_MODE_TOOL_NAMES.has("research.fetchUrl"), true);
  });

  it("defaultMaxSteps is bounded", () => {
    const n = defaultMaxSteps();
    assert.ok(n >= 1 && n <= 128);
  });
});
