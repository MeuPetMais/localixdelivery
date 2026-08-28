export const ADMIN_AUTH_VALIDATION_ERROR =
  "Não foi possível validar sua autorização administrativa. Tente novamente.";

export type AdminLoginSupabase = {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
      data: {
        user?: { id: string } | null;
        session?: { access_token?: string | null; refresh_token?: string | null } | null;
      };
      error?: unknown;
    }>;
    setSession: (session: { access_token: string; refresh_token: string }) => Promise<{ error?: unknown }>;
    signOut: () => Promise<unknown>;
  };
  from: (table: "user_roles") => {
    select: (columns: "role") => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: "admin") => {
          maybeSingle: () => Promise<{ data?: { role: string } | null; error?: unknown }>;
        };
      };
    };
  };
};

export type AdminLoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_credentials" | "invalid_session" | "authorization_error" | "forbidden" };

export async function validateAdminLogin(
  supabaseClient: AdminLoginSupabase,
  email: string,
  password: string,
): Promise<AdminLoginResult> {
  const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (signInError || !data.user) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const accessToken = data.session?.access_token;
  const refreshToken = data.session?.refresh_token;
  if (!accessToken || !refreshToken) {
    return { ok: false, reason: "invalid_session" };
  }

  const { error: sessionError } = await supabaseClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    return { ok: false, reason: "invalid_session" };
  }

  const { data: role, error: roleError } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    return { ok: false, reason: "authorization_error" };
  }

  if (!role) {
    await supabaseClient.auth.signOut();
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, userId: data.user.id };
}
