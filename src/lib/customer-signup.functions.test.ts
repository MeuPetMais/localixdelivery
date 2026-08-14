import { describe, expect, it, vi } from "vitest";
import {
  assertCustomerSignupRateLimit,
  createConfirmedCustomerUser,
  hashRateLimitValue,
} from "./customer-signup.functions";
import {
  buildCustomerSignupMetadata,
  customerSignupSchema,
  isDuplicateAuthUserError,
} from "./customer-signup";

describe("customer signup contracts", () => {
  it("normalizes the public input and does not accept role metadata", () => {
    const parsed = customerSignupSchema.parse({
      name: " Ana Cliente ",
      email: "ANA@EXAMPLE.COM",
      password: "senha123",
      role: "admin",
      app_metadata: { role: "partner" },
    });

    expect(parsed).toEqual({
      name: "Ana Cliente",
      email: "ana@example.com",
      password: "senha123",
    });
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(() =>
      customerSignupSchema.parse({
        name: "Ana Cliente",
        email: "ana@example.com",
        password: "1234567",
      }),
    ).toThrow();
  });

  it("builds only customer metadata for Admin API createUser", () => {
    const metadata = buildCustomerSignupMetadata({
      name: "Ana Cliente",
      email: "ana@example.com",
      password: "senha123",
    });

    expect(metadata).toEqual({
      user_metadata: {
        full_name: "Ana Cliente",
        name: "Ana Cliente",
        kind: "customer",
        account_type: "customer",
      },
      app_metadata: {
        provider: "email",
        account_type: "customer",
      },
    });
    expect(JSON.stringify(metadata)).not.toContain("admin");
    expect(JSON.stringify(metadata)).not.toContain("partner");
  });

  it("maps existing e-mail errors to the friendly duplicate path", () => {
    expect(isDuplicateAuthUserError({ code: "email_already_exists" })).toBe(true);
    expect(isDuplicateAuthUserError({ message: "User already registered" })).toBe(true);
    expect(isDuplicateAuthUserError({ message: "weak password" })).toBe(false);
  });
});

function createSupabaseMock(options?: {
  roles?: string[];
  profileError?: unknown;
  roleError?: unknown;
  rateLimitAllowed?: boolean;
  rollbackError?: unknown;
}) {
  const createUser = vi.fn(async () => ({
    data: { user: { id: "user-123" } },
    error: null,
  }));
  const deleteUser = vi.fn(async () => ({ error: options?.rollbackError ?? null }));
  const rpc = vi.fn(async () => ({ data: options?.rateLimitAllowed ?? true, error: null }));
  const upsert = vi.fn(async () => ({ error: options?.roleError ?? null }));

  return {
    auth: { admin: { createUser, deleteUser } },
    rpc,
    from: vi.fn((table: string) => {
      if (table === "customer_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: options?.profileError
                  ? null
                  : { id: "user-123", email: "ana@example.com", full_name: "Ana Cliente" },
                error: options?.profileError ?? null,
              })),
            })),
          })),
        };
      }

      if (table === "user_roles") {
        return {
          upsert,
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: (options?.roles ?? ["customer"]).map((role) => ({ role })),
              error: null,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    createUser,
    deleteUser,
    upsert,
  };
}

describe("customer signup server flow", () => {
  const data = {
    name: "Ana Cliente",
    email: "ana@example.com",
    password: "senha123",
  };

  it("creates a confirmed customer and verifies the final role is only customer", async () => {
    const supabase = createSupabaseMock();

    await expect(createConfirmedCustomerUser(supabase, data)).resolves.toEqual({
      userId: "user-123",
    });

    expect(supabase.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@example.com",
        password: "senha123",
        email_confirm: true,
        app_metadata: expect.objectContaining({ account_type: "customer" }),
        user_metadata: expect.objectContaining({ account_type: "customer", kind: "customer" }),
      }),
    );
    const createUserPayload = supabase.createUser.mock.calls.at(0)?.at(0);
    expect(JSON.stringify(createUserPayload)).not.toContain("partner");
    expect(supabase.upsert).toHaveBeenCalledWith(
      { user_id: "user-123", role: "customer" },
      { onConflict: "user_id,role" },
    );
    expect(supabase.deleteUser).not.toHaveBeenCalled();
  });

  it("fails closed and rolls back when customer_profiles is missing", async () => {
    const supabase = createSupabaseMock({ profileError: { message: "missing" } });

    await expect(createConfirmedCustomerUser(supabase, data)).rejects.toThrow(
      "Não foi possível concluir",
    );

    expect(supabase.deleteUser).toHaveBeenCalledWith("user-123");
  });

  it("fails closed when rollback itself fails", async () => {
    const supabase = createSupabaseMock({
      profileError: { message: "missing" },
      rollbackError: { message: "delete failed" },
    });

    await expect(createConfirmedCustomerUser(supabase, data)).rejects.toThrow(
      "Não foi possível concluir",
    );

    expect(supabase.deleteUser).toHaveBeenCalledWith("user-123");
  });

  it("rejects a final role set that contains partner", async () => {
    const supabase = createSupabaseMock({ roles: ["customer", "partner"] });

    await expect(createConfirmedCustomerUser(supabase, data)).rejects.toThrow(
      "Não foi possível concluir",
    );

    expect(supabase.deleteUser).toHaveBeenCalledWith("user-123");
  });

  it("uses the shared Postgres rate limit between calls", async () => {
    const supabase = createSupabaseMock({ rateLimitAllowed: false });

    await expect(
      assertCustomerSignupRateLimit(supabase, "ana@example.com", "203.0.113.10"),
    ).rejects.toThrow("Muitas tentativas");

    expect(supabase.rpc).toHaveBeenCalledWith("check_customer_signup_rate_limit", {
      ip_hash: await hashRateLimitValue("203.0.113.10"),
      email_hash: await hashRateLimitValue("ana@example.com"),
      max_attempts: 5,
      window_seconds: 600,
    });
  });
});
