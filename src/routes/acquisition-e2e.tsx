import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/acquisition-e2e")({
  ssr: false,
  component: AcquisitionE2E,
});

const testRef = "staging-meta-e2e-v1";

function AcquisitionE2E() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult("");
    const { data, error } = await supabase.functions.invoke("partner-lead-public-capture", {
      body: {
        business_name: "Pizzaria Meta E2E Staging",
        contact_name: "Lead Teste Meta",
        phone: "11988887777",
        segment: "Pizzaria",
        city: "São Paulo",
        neighborhood: "Santo Amaro",
        estimated_monthly_orders: 250,
        main_pain: "Validacao E2E de atribuicao publica",
        source: "meta_ads",
        medium: "paid_social",
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "paid_partners_spzs_validation_v1",
        utm_content: "creative_e2e_01",
        utm_term: "pizzaria_zona_sul",
        meta_campaign_id: "cmp_e2e_001",
        meta_adset_id: "adset_e2e_001",
        meta_ad_id: "ad_e2e_001",
        creative_code: "creative_e2e_01",
        external_ref: testRef,
        website: "",
      },
    });
    setLoading(false);
    setResult(JSON.stringify({ data, error: error?.message ?? null }, null, 2));
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Staging — E2E aquisição pública</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Teste controlado. Não usar em produção. O mesmo external_ref é reutilizado para
            validar idempotência.
          </p>
          <div className="space-y-1">
            <Label>Campanha</Label>
            <Input readOnly value="paid_partners_spzs_validation_v1" />
          </div>
          <div className="space-y-1">
            <Label>Criativo</Label>
            <Input readOnly value="creative_e2e_01" />
          </div>
          <div className="space-y-1">
            <Label>External ref</Label>
            <Input readOnly value={testRef} />
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? "Executando..." : "Executar captura E2E"}
          </Button>
          {result && <pre className="overflow-auto rounded bg-muted p-3 text-xs">{result}</pre>}
        </CardContent>
      </Card>
    </main>
  );
}
