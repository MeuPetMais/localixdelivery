import { z } from "zod";

export const customerSignupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(100),
});

export type CustomerSignupInput = z.input<typeof customerSignupSchema>;
export type CustomerSignupData = z.output<typeof customerSignupSchema>;

export function buildCustomerSignupMetadata(data: CustomerSignupData) {
  return {
    user_metadata: {
      full_name: data.name,
      name: data.name,
      kind: "customer",
      account_type: "customer",
    },
    app_metadata: {
      provider: "email",
      account_type: "customer",
    },
  };
}

export function isDuplicateAuthUserError(error: unknown) {
  const e = (error ?? {}) as { code?: string; message?: string; status?: number };
  const code = String(e.code ?? "").toLowerCase();
  const msg = String(e.message ?? "").toLowerCase();
  return (
    code === "email_already_exists" ||
    code === "user_already_exists" ||
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  );
}
