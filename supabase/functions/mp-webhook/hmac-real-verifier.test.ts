import { createHmac, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Exercise the actual TypeScript HMAC verifier in the deployed receiver, not a
// duplicated test-only reimplementation. Every event and secret is synthetic.
const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const start = source.indexOf("async function verifySignature(");
const end = source.indexOf("async function fetchMpPayment(");
if (start < 0 || end <= start) throw Error("webhook_verifier_not_found");
const js = ts.transpileModule(
  source.slice(start, end) + "\nexports.verifySignature = verifySignature;",
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
type Verify = (input: {
  secret: string | null;
  xSignature: string | null;
  xRequestId: string | null;
  dataIdFromQuery: string | null;
  dataIdFromBody: string | null;
}) => Promise<{ ok: boolean; reason?: string }>;
const exports: Record<string, Verify> = {};
runInNewContext(js, { exports, crypto: webcrypto, TextEncoder });
const verify = exports.verifySignature;

const secret = "synthetic-hmac-test-secret";
const id = "1234567";
const requestId = "synthetic-request";
const tsValue = "1794672000";
const manifest = `id:${id};request-id:${requestId};ts:${tsValue};`;
const digest = createHmac("sha256", secret).update(manifest).digest("hex");
const base = {
  secret,
  xSignature: `ts=${tsValue},v1=${digest}`,
  xRequestId: requestId,
  dataIdFromQuery: id,
  dataIdFromBody: null,
};

describe("Gate 4 webhook HMAC verification", () => {
  it("accepts a correct signed payment webhook", async () => {
    expect((await verify(base)).ok).toBe(true);
  });

  it("rejects an altered resource id or request id", async () => {
    expect((await verify({ ...base, dataIdFromQuery: "9876543" })).ok).toBe(false);
    expect((await verify({ ...base, xRequestId: "forged-request" })).ok).toBe(false);
  });

  it("rejects missing or forged secret/signature", async () => {
    expect((await verify({ ...base, secret: null })).ok).toBe(false);
    expect((await verify({ ...base, xSignature: null })).ok).toBe(false);
    expect((await verify({ ...base, secret: "wrong-secret" })).ok).toBe(false);
    expect((await verify({ ...base, xSignature: `ts=${tsValue},v1=abcd` })).ok).toBe(false);
  });
});
