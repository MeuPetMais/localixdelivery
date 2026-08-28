import { describe, expect, it, vi } from "vitest";
import { validateAdminLogin } from "@/lib/admin-login";

function createRoleQuery(result: { data?: { role: string } | null; error?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const roleEq = vi.fn(() => ({ maybeSingle }));
  const userEq = vi.fn(() => ({ eq: roleEq }));
  const select = vi.fn(() => ({ eq: userEq }));

  return { select, userEq, roleEq, maybeSingle };
}

function createSupabaseMock(options: {
  signIn?: {
    data: {
      user?: { id: string } | null;
      session?: { access_token?: string | null; refresh_token?: string | null } | null;
    };
    error?: unknown;
  };
  setSessionError?: unknown;
  roleResult?: { data?: { role: string } | null; error?: unknown };
}) {
  const roleQuery = createRoleQuery(options.roleResult ?? { data: { role: "admin" } });
  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(
        options.signIn ?? {
          data: {
            user: { id: "admin-user-id" },
            session: { access_token: "access-token", refresh_token: "refresh-token" },
          },
        },
      ),
      setSession: vi.fn().mockResolvedValue({ error: options.setSessionError }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn(() => ({ select: roleQuery.select })),
  };

  return { client, roleQuery };
}

describe("admin login authorization", () => {
  it("denies invalid credentials before checking roles", async () => {
    const { client } = createSupabaseMock({
      signIn: { data: { user: null, session: null }, error: new Error("invalid login") },
    });

    await expect(validateAdminLogin(client, "admin@example.com", "wrong")).resolves.toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
    expect(client.auth.setSession).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("allows a valid login with a valid session and admin role", async () => {
    const { client, roleQuery } = createSupabaseMock({});

    await expect(validateAdminLogin(client, " admin@example.com ", "secret")).resolves.toEqual({
      ok: true,
      userId: "admin-user-id",
    });

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "secret",
    });
    expect(client.auth.setSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(client.from).toHaveBeenCalledWith("user_roles");
    expect(roleQuery.select).toHaveBeenCalledWith("role");
    expect(roleQuery.userEq).toHaveBeenCalledWith("user_id", "admin-user-id");
    expect(roleQuery.roleEq).toHaveBeenCalledWith("role", "admin");
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("does not classify a role query error as non-admin", async () => {
    const { client } = createSupabaseMock({
      roleResult: { data: null, error: { status: 401, message: "JWT missing" } },
    });

    await expect(validateAdminLogin(client, "admin@example.com", "secret")).resolves.toEqual({
      ok: false,
      reason: "authorization_error",
    });
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("returns a technical auth error when sign-in succeeds without a valid session", async () => {
    const { client } = createSupabaseMock({
      signIn: { data: { user: { id: "admin-user-id" }, session: null } },
    });

    await expect(validateAdminLogin(client, "admin@example.com", "secret")).resolves.toEqual({
      ok: false,
      reason: "invalid_session",
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("returns 403 only when the role query succeeds without an admin role", async () => {
    const { client } = createSupabaseMock({
      roleResult: { data: null },
    });

    await expect(validateAdminLogin(client, "user@example.com", "secret")).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("never grants access without an admin role", async () => {
    for (const roleResult of [{ data: null }, { data: undefined }]) {
      const { client } = createSupabaseMock({ roleResult });

      await expect(validateAdminLogin(client, "user@example.com", "secret")).resolves.toEqual({
        ok: false,
        reason: "forbidden",
      });
    }
  });
});
