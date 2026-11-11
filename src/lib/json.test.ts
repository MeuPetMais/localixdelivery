import { describe, it, expect } from "vitest";
import { toJson, record, jsonObject } from "./json";
describe("JSON database boundary", () => {
  it("matches transport serialization for nested values and dates", () => {
    expect(
      toJson({
        at: new Date("2026-01-01T00:00:00Z"),
        metadata: { amount: 10, missing: undefined },
        items: [null, true],
      }),
    ).toEqual({ at: "2026-01-01T00:00:00.000Z", metadata: { amount: 10 }, items: [null, true] });
  });
  it("narrows JSON objects without trusting arrays or primitives", () => {
    expect(record(null)).toEqual({});
    expect(record([])).toEqual({});
    expect(jsonObject("bad")).toEqual({});
    expect(record({ status: "paid" })).toEqual({ status: "paid" });
  });
});
