import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/commercial-claim-production-e2e")({
  component: CommercialClaimProductionE2E,
  ssr: false,
});

const LEAD_ID = "d6204507-b8b2-4137-b294-6e587676acbf";
const RESTAURANT_ID = "58c6def7-03bd-4a3a-aeae-1aa03e82105e";

function CommercialClaimProductionE2E() {
  const [email, setEmail] = useState("alexandre@rngdigital.com.br");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    setResult({ authenticated: Boolean(data.user), user_id: data.user?.id ?? null, error });
    setBusy(false);
  }

  async function claim(label: string) {
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("claim_partner_lead", { _lead_id: LEAD_ID });
    setResult({ test: label, user_id: userData.user?.id ?? null, data, error });
    setBusy(false);
  }

  async function convert() {
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("convert_partner_lead", {
      _lead_id: LEAD_ID,
      _restaurant_id: RESTAURANT_ID,
    });
    setResult({ test: "convert_claimed_lead", user_id: userData.user?.id ?? null, data, error });
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">E2E Production — Claim e conversão</h1>
      <p className="mt-2 text-sm">Rota temporária. Não será mergeada em main.</p>
      <div className="mt-6 grid gap-3">
        <input className="rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded border p-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" />
        <button className="rounded border p-2" disabled={busy} onClick={login}>Autenticar no preview</button>
        <button className="rounded border p-2" disabled={busy} onClick={() => claim("claim_1")}>Executar Claim #1</button>
        <button className="rounded border p-2" disabled={busy} onClick={() => claim("claim_2_idempotency")}>Executar Claim #2 (idempotência)</button>
        <button className="rounded border p-2" disabled={busy} onClick={convert}>Converter para Hamburgueria teste</button>
      </div>
      <pre className="mt-6 overflow-auto rounded border p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
