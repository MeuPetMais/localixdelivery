import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../tracking/location/driver-location.functions.ts", import.meta.url),
  "utf8",
);

describe("driver location auth context", () => {
  it("calls the operational location RPC with the authenticated Supabase client", () => {
    expect(source).toContain(".handler(async ({ data, context }) =>");
    expect(source).toContain(
      'context.supabase.rpc("upsert_driver_operational_location" as never',
    );
  });

  it("does not call the location RPC through supabaseAdmin", () => {
    expect(source).not.toContain(
      'supabaseAdmin.rpc("upsert_driver_operational_location"',
    );
  });
});
