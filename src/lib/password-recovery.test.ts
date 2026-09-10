import { describe, expect, it, vi } from "vitest";
import { readRecoveryParams, validateRecoveryLink, verifyRecoveryOtp } from "./password-recovery";

function createAuthMock() {
  return {
    verifyOtp: vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: "session" } }, error: null }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: "legacy" } }, error: null }),
  };
}

describe("password recovery link validation", () => {
  it("reads token_hash and recovery type from the reset URL", () => {
    const params = readRecoveryParams(
      "https://localixdelivery-staging.vercel.app/redefinir-senha?token_hash=abc&type=recovery",
    );

    expect(params.tokenHash).toBe("abc");
    expect(params.type).toBe("recovery");
  });

  it("keeps token_hash recovery links pending to avoid prefetch consumption", async () => {
    const auth = createAuthMock();
    const result = await validateRecoveryLink(
      auth,
      "https://localixdelivery-staging.vercel.app/redefinir-senha?token_hash=abc&type=recovery",
    );

    expect(result).toEqual({ ok: true, mode: "token_hash", tokenHash: "abc" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("verifies token_hash only when the user submits the new password", async () => {
    const auth = createAuthMock();

    const result = await verifyRecoveryOtp(auth, "abc");

    expect(result).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "recovery" });
  });

  it("keeps fallback for legacy access_token links", async () => {
    const auth = createAuthMock();
    const result = await validateRecoveryLink(
      auth,
      "https://localixdelivery-staging.vercel.app/redefinir-senha#access_token=a&refresh_token=r",
    );

    expect(result).toEqual({ ok: true, mode: "legacy_tokens" });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("allows an already detected recovery session without URL tokens", async () => {
    const auth = createAuthMock();
    const result = await validateRecoveryLink(
      auth,
      "https://localixdelivery-staging.vercel.app/redefinir-senha",
    );

    expect(result).toEqual({ ok: true, mode: "existing_session" });
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("rejects a reset page opened without tokens or session", async () => {
    const auth = createAuthMock();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const result = await validateRecoveryLink(
      auth,
      "https://localixdelivery-staging.vercel.app/redefinir-senha",
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid_or_expired",
      code: undefined,
      message: undefined,
    });
  });
});
