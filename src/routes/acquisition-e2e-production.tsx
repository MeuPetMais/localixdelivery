import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/acquisition-e2e-production")({
  ssr: false,
  component: AcquisitionE2EProduction,
});

const payload = {
  business_name: "Pizzaria E2E Production Localix",
  contact_name: "Lead Teste Production",
  phone: "11977776666",
  segment: "Pizzaria",
  city: "São Paulo",
  neighborhood: "Santo Amaro",
  estimated_monthly_orders: 250,
  main_pain: "Validacao E2E publica em Production",
  source: "e2e_production",
  medium: "controlled_test",
  utm_source: "localix",
  utm_medium: "controlled_test",
  utm_campaign: "production_public_capture_e2e",
  utm_content: "e2e_production_01",
  creative_code: "e2e_production_01",
  external_ref: "production-public-e2e-v1",
  website: "",
};

function AcquisitionE2EProduction() {
  const [result, setResult] = useState("Aguardando teste.");
  const [loading, setLoading] = useState(false);

  async function runTest() {
    setLoading(true);
    try {
      const response = await fetch(
        "https://mvkfrwxgneqzvoabkaws.supabase.co/functions/v1/partner-lead-public-capture",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.text();
      setResult(`HTTP ${response.status}\n${body}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-3 text-2xl font-semibold">E2E público Production</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Rota temporária para validar a captura pública. Execute duas vezes para
        comprovar idempotência.
      </p>
      <Button onClick={runTest} disabled={loading}>
        {loading ? "Executando..." : "Executar teste"}
      </Button>
      <pre className="mt-6 whitespace-pre-wrap rounded-md border p-4 text-xs">
        {result}
      </pre>
    </main>
  );
}
