import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Redefinir senha — Localix" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { currentRestaurantSlug, lastRestaurantSlug } = useCustomerNavigation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Detect recovery errors from URL hash (expired/invalid token)
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const err = params.get("error_description") || params.get("error");
    if (err) {
      setTokenError(
        /expired/i.test(err)
          ? "O link de redefinição expirou. Solicite um novo."
          : "Link inválido ou já utilizado. Solicite um novo.",
      );
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("A confirmação não confere com a nova senha");
      return;
    }
    setLoading(true);
    if (import.meta.env.DEV) console.info("[auth-debug] updateUser:before", { screen: "/redefinir-senha", reason: "password reset", fields: ["password"], passwordLength: password.length });
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (import.meta.env.DEV) {
        const er = error as { code?: string; status?: number; message?: string } | null;
        console.info("[auth-debug] updateUser:after", { ok: !error, userId: data?.user?.id, errorCode: er?.code, errorStatus: er?.status, errorMessage: er?.message });
      }
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar senha";
      if (/expired|invalid|token/i.test(msg)) {
        setTokenError("Link inválido ou expirado. Solicite um novo.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function goToPanel() {
    const slug = currentRestaurantSlug ?? lastRestaurantSlug;
    if (slug) {
      navigate({ to: "/$slug", params: { slug }, replace: true });
    } else {
      navigate({ to: "/auth", replace: true, search: { mode: undefined } as { mode: string | undefined } });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-6">
        <Card className="rounded-2xl p-6 shadow-glow">
          {success ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-success/10 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold">Senha atualizada</h1>
                <p className="mt-1 text-sm text-muted-foreground">Sua senha foi alterada com sucesso.</p>
              </div>
              <Button className="h-11 w-full" onClick={goToPanel}>Entrar no painel</Button>
            </div>
          ) : tokenError ? (
            <div className="space-y-5 text-center">
              <div>
                <h1 className="font-display text-2xl font-extrabold">Link indisponível</h1>
                <p className="mt-2 text-sm text-muted-foreground">{tokenError}</p>
              </div>
              <Button className="h-11 w-full" onClick={() => navigate({ to: "/auth", replace: true, search: { mode: undefined } as { mode: string | undefined } })}>
                Voltar para login
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h1 className="font-display text-2xl font-extrabold">Criar nova senha</h1>
                <p className="mt-1 text-sm text-muted-foreground">Defina sua nova senha de acesso.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pwd">Nova senha</Label>
                  <PasswordInput id="pwd" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pwd2">Confirmar nova senha</Label>
                  <PasswordInput id="pwd2" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Atualizar senha
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
