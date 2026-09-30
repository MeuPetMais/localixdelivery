import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/commercial-conversion-e2e")({
  ssr: false,
  component: CommercialConversionE2E,
});

function CommercialConversionE2E() {
  const [email, setEmail] = useState("alexandre@rngdigital.com.br");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("Faça login no preview antes de executar a conversão.");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setPassword("");
      setResult(
        error
          ? JSON.stringify({ error: { code: error.code, message: error.message } }, null, 2)
          : JSON.stringify({ authenticated: true, user_id: data.user?.id }, null, 2),
      );
    } finally {
      setLoading(false);
    }
  }

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
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="mb-3 text-2xl font-semibold">E2E conversão comercial</h1>
        <p className="text-sm text-muted-foreground">
          Teste temporário autenticado para converter o lead E2E no restaurante de teste.
        </p>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="e2e-email">E-mail</Label>
          <Input
            id="e2e-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e2e-password">Senha</Label>
          <PasswordInput
            id="e2e-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <Button onClick={signIn} disabled={loading || !email || !password}>
          Autenticar no preview
        </Button>
      </div>

      <Button onClick={runTest} disabled={loading}>
        {loading ? "Executando..." : "Executar conversão"}
      </Button>
      <pre className="whitespace-pre-wrap rounded-md border p-4 text-xs">{result}</pre>
    </main>
  );
}
