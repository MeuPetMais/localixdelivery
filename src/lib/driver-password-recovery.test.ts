import { describe, expect, it, vi } from "vitest";
import { readDriverRecoveryParams, validateDriverRecoveryLink } from "./driver-password-recovery";

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

describe("driver password recovery link validation", () => {
  it("reads token_hash and recovery type from Localix URL", () => {
    const params = readDriverRecoveryParams(
      "https://localixdelivery.rngdigital.com.br/entregador/redefinir-senha?token_hash=abc&type=recovery",
    );

    expect(params.tokenHash).toBe("abc");
    expect(params.type).toBe("recovery");
  });

  it("uses verifyOtp for token_hash recovery links", async () => {
    const auth = createAuthMock();
    const result = await validateDriverRecoveryLink(
      auth,
      "https://localixdelivery.rngdigital.com.br/entregador/redefinir-senha?token_hash=abc&type=recovery",
    );

    expect(result).toEqual({ ok: true, mode: "token_hash" });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "recovery" });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("does not treat an initial null session as failure before verifyOtp", async () => {
    const auth = createAuthMock();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const result = await validateDriverRecoveryLink(
      auth,
      "https://localixdelivery.rngdigital.com.br/entregador/redefinir-senha?token_hash=abc&type=recovery",
    );

    expect(result).toEqual({ ok: true, mode: "token_hash" });
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("shows invalid only after explicit verifyOtp error", async () => {
    const auth = createAuthMock();
    auth.verifyOtp.mockResolvedValue({
      data: null,
      error: { code: "otp_expired", message: "Token has expired" },
    });

    const result = await validateDriverRecoveryLink(
      auth,
      "https://localixdelivery.rngdigital.com.br/entregador/redefinir-senha?token_hash=abc&type=recovery",
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid_or_expired",
      code: "otp_expired",
      message: "Token has expired",
    });
  });

  it("keeps temporary fallback for legacy access_token links", async () => {
    const auth = createAuthMock();
    const result = await validateDriverRecoveryLink(
      auth,
      "https://localixdelivery.rngdigital.com.br/entregador/redefinir-senha#access_token=a&refresh_token=r",
    );

    expect(result).toEqual({ ok: true, mode: "legacy_tokens" });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
