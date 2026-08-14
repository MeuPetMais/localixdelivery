import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Bike, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { recordDriverPasswordResetCompleted } from "@/lib/driver-activation.functions";

export const Route = createFileRoute("/entregador/redefinir-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redefinir senha - Localix Entregador" }] }),
  component: ResetDriverPassword,
});

function readRecoveryTokens() {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const accessToken = hash.get("access_token") ?? query.get("access_token");
  const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

function ResetDriverPassword() {
  const nav = useNavigate();
  const recordCompleted = useServerFn(recordDriverPasswordResetCompleted);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function prepareSession() {
      try {
        const tokens = readRecoveryTokens();
        if (tokens) {
          const { error } = await supabase.auth.setSession(tokens);
          if (error) throw error;
          window.history.replaceState(null, "", "/entregador/redefinir-senha");
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (alive) setReady(!!data.session);
      } catch (e) {
        console.error("[driver-password-reset] recovery session failed", {
          stage: "prepare_session",
          message: (e as Error).message,
        });
        if (alive) setReady(false);
      } finally {
        if (alive) setChecking(false);
      }
    }
    prepareSession();
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    if (password.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (password !== confirmPassword) return toast.error("As senhas nao coincidem");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await recordCompleted().catch((e: Error) => {
        console.error("[driver-password-reset] audit completion failed", {
          stage: "record_completion",
          message: e.message,
        });
      });
      await supabase.auth.signOut();
      toast.success("Senha redefinida. Entre novamente para continuar.");
      nav({ to: "/entregador/entrar", replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-md px-4 pt-10 pb-16">
        <Link
          to="/entregador/entrar"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para login
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Localix Entregador
            </p>
            <p className="font-display text-lg font-extrabold leading-tight">Redefinir senha</p>
          </div>
        </div>

        <Card className="rounded-3xl border-none p-6 shadow-sm">
          {checking ? (
            <p className="text-sm text-muted-foreground">Validando link seguro...</p>
          ) : !ready ? (
            <>
              <h1 className="font-display text-xl font-extrabold">Link invalido ou expirado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Solicite uma nova recuperacao ou peca ao restaurante para gerar outro link.
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-primary" /> Defina uma nova senha
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Nova senha</Label>
                  <PasswordInput
                    placeholder="Minimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label>Confirmar senha</Label>
                  <PasswordInput
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
              </div>
              <Button className="mt-6 w-full rounded-2xl" onClick={submit} disabled={loading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
