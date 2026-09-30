import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/commercial-conversion-e2e")({
  ssr: false,
  component: CommercialConversionE2E,
});

function CommercialConversionE2E() {
  const [result, setResult] = useState("Aguardando teste.");
  const [loading, setLoading] = useState(false);

  async function runTest() {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setResult("Usuário não autenticado.");
        return;
      }

      const { data, error } = await supabase.schema("private").rpc("convert_partner_lead", {
        _lead_id: "d6204507-b8b2-4137-b294-6e587676acbf",
        _restaurant_id: "58c6def7-03bd-4a3a-aeae-1aa03e82105e",
      });

      setResult(JSON.stringify({ user_id: authData.user.id, data, error }, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-3 text-2xl font-semibold">E2E conversão comercial</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Teste temporário autenticado para converter o lead E2E no restaurante de teste.
      </p>
      <Button onClick={runTest} disabled={loading}>
        {loading ? "Executando..." : "Executar conversão"}
      </Button>
      <pre className="mt-6 whitespace-pre-wrap rounded-md border p-4 text-xs">{result}</pre>
    </main>
  );
}
