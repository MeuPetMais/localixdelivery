// Autenticação: valida o JWT do usuário logado e confirma que ele é dono
// (ou admin) do restaurante alvo. Retorna clients admin já prontos.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuthContext {
  userId: string;
  restaurantId: string;
  admin: SupabaseClient;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireOwner(
  req: Request,
  restaurantId: string,
): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) throw new Response("Unauthorized", { status: 401 });
  const userId = userData.user.id;

  const { data: rest } = await admin
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!rest) throw new Response("Restaurant not found", { status: 404 });

  if (rest.owner_id !== userId) {
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Response("Forbidden", { status: 403 });
  }

  return { userId, restaurantId, admin };
}
