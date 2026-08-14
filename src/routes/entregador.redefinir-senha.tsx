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
import {
  hasDriverRecoveryParams,
  validateDriverRecoveryLink,
} from "@/lib/driver-password-recovery";

export const Route = createFileRoute("/entregador/redefinir-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redefinir senha - Localix Entregador" }] }),
  component: ResetDriverPassword,
});

type RecoveryStatus = "checking" | "valid" | "invalid" | "completed";

function ResetDriverPassword() {
  const nav = useNavigate();
  const recordCompleted = useServerFn(recordDriverPasswordResetCompleted);
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function prepareSession() {
      try {
        const href = window.location.href;
        const result = await validateDriverRecoveryLink(supabase.auth, href);
        if (hasDriverRecoveryParams(href)) {
          window.history.replaceState(null, "", "/entregador/redefinir-senha");
        }
        if (alive) setStatus(result.ok ? "valid" : "invalid");
      } catch (e) {
        console.error("[driver-password-reset] recovery session failed", {
          stage: "prepare_session",
          code: (e as { code?: string }).code,
          message: (e as Error).message,
        });
        if (alive) setStatus("invalid");
      }
    }
    prepareSession();
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    if (password.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (password !== confirmPassword) return toast.error("As senhas não coincidem");
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
      setStatus("completed");
      toast.success("Senha redefinida com sucesso.");
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
          {status === "checking" ? (
            <p className="text-sm text-muted-foreground">Validando link de recuperação...</p>
          ) : status === "invalid" ? (
            <>
              <h1 className="font-display text-xl font-extrabold">Link inválido ou expirado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Solicite uma nova recuperação ou peça ao restaurante para gerar outro link.
              </p>
            </>
          ) : status === "completed" ? (
            <>
              <h1 className="font-display text-xl font-extrabold">Senha redefinida com sucesso.</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Entre novamente com sua nova senha para continuar.
              </p>
              <Button
                className="mt-6 w-full rounded-2xl"
                onClick={() => nav({ to: "/entregador/entrar", replace: true })}
              >
                Ir para o login
              </Button>
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
                    placeholder="Mínimo 8 caracteres"
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
                {loading ? "Salvando..." : "Redefinir senha"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
