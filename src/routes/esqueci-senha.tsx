import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — Localix" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectTo = `${window.location.origin}/redefinir-senha`;
    if (import.meta.env.DEV) console.info("[auth-debug] resetPasswordForEmail:start", { ts: new Date().toISOString(), email, redirectTo, screen: "/esqueci-senha" });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (import.meta.env.DEV) {
        const er = error as { code?: string; status?: number; message?: string } | null;
        console.info("[auth-debug] resetPasswordForEmail:return", { ok: !error, errorCode: er?.code, errorStatus: er?.status, errorMessage: er?.message });
      }
      if (error) throw error;
      setSent(true);
      toast.success("Verifique seu e-mail");
    } catch (err) {
      if (import.meta.env.DEV) console.error("[auth-debug] resetPasswordForEmail:catch", err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <Link to="/entrar" className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <Card className="p-6 shadow-xl">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-extrabold">Esqueci minha senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {sent ? "Enviamos um link para redefinir sua senha." : "Informe seu e-mail e enviaremos um link de recuperação."}
            </p>
          </div>

          {!sent && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar link
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
