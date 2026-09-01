import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { matchesDriverIdentifier } from "@/lib/driver-auth";

type DriverRow = {
  id: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  owner_id: string | null;
};

export const resolveUniversalDriverEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ identifier: z.string().trim().min(3).max(60) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, cpf, phone, email, status, owner_id")
      .eq("status", "ativo");
    if (rowsError) throw new Error(rowsError.message);

    const matches = (rows ?? []).filter((row: DriverRow) =>
      matchesDriverIdentifier(row, data.identifier),
    );
    if (matches.length === 0) return { found: false as const };

    let ownerId = matches.find((row: DriverRow) => row.owner_id)?.owner_id ?? null;

    if (!ownerId) {
      const driverIds = matches.map((row: DriverRow) => row.id);
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from("driver_restaurant_memberships")
        .select("owner_id, driver_id, status")
        .in("driver_id", driverIds)
        .eq("status", "ativo");
      if (membershipError) throw new Error(membershipError.message);
      ownerId = memberships?.find((membership: any) => membership.owner_id)?.owner_id ?? null;
    }

    if (!ownerId) return { found: false as const };

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(ownerId);
    if (authError || !authUser?.user?.email) return { found: false as const };

    return { found: true as const, email: authUser.user.email };
  });
