// RC6.2 — Login próprio do Entregador (separado do restaurante)
// Aceita CPF ou Telefone + senha. Resolve o e-mail no servidor e faz
// signInWithPassword. Após login, segue para a seleção de estabelecimento.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, ArrowLeft, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { resolveDriverEmail } from "@/lib/driver-activation.functions";

export const Route = createFileRoute("/entregador/entrar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar como Entregador — Localix" },
      { name: "description", content: "Acesse sua conta de entregador com CPF ou telefone." },
    ],
  }),
  component: DriverLogin,
});

function DriverLogin() {
  const nav = useNavigate();
  const resolve = useServerFn(resolveDriverEmail);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const id = identifier.trim();
    if (id.length < 3) return toast.error("Informe seu CPF ou telefone");
    if (password.length < 8) return toast.error("Senha inválida");
    setLoading(true);
    try {
      const res = await resolve({ data: { identifier: id } });
      if (!res.found) {
        toast.error("Não encontramos sua conta. Verifique os dados ou ative sua conta.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: res.email, password,
      });
      if (error) throw error;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Não foi possível confirmar a sessão. Tente novamente.");
      nav({ to: "/motoboy-estabelecimentos", replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-md px-4 pt-10 pb-16">
        <Link to="/entregador" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Localix Entregador</p>
            <p className="font-display text-lg font-extrabold leading-tight">Entrar como Entregador</p>
          </div>
        </div>

        <Card className="rounded-3xl border-none p-6 shadow-sm">
          <div className="space-y-3">
            <div>
              <Label>CPF ou Telefone</Label>
              <Input
                inputMode="tel"
                placeholder="000.000.000-00 ou (11) 90000-0000"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <PasswordInput
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
          </div>
          <Button className="mt-6 w-full rounded-2xl" onClick={submit} disabled={loading}>
            <LogIn className="mr-2 h-4 w-4" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <div className="mt-4 flex items-center justify-between text-xs">
            <Link to="/entregador/esqueci-senha" className="text-muted-foreground underline underline-offset-4">
              Esqueci minha senha
            </Link>
            <Link to="/entregador/ativar" className="text-primary font-medium">
              Ativar minha conta
            </Link>
          </div>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Uma única conta pode operar em mais de um estabelecimento parceiro.
        </p>
      </div>
    </div>
  );
}
