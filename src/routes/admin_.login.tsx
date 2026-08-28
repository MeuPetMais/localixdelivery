import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_AUTH_VALIDATION_ERROR, validateAdminLogin } from "@/lib/admin-login";

export const Route = createFileRoute("/admin_/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (role) throw redirect({ to: "/admin" });
    }
  },
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await validateAdminLogin(supabase, email, password);
      if (!result.ok && result.reason === "invalid_credentials") {
        setError("Credenciais inválidas.");
        return;
      }
      if (!result.ok && result.reason === "forbidden") {
        setError("403 — Acesso negado.");
        return;
      }
      if (!result.ok) {
        setError(ADMIN_AUTH_VALIDATION_ERROR);
        return;
      }
      toast.success("Bem-vindo, administrador.");
      navigate({ to: "/admin", replace: true });
    } catch {
      setError("Falha no login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 p-8 text-slate-100">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold">Localix Admin</h1>
            <p className="text-xs text-slate-400">Acesso restrito</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-100"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Entrar
          </Button>

          <p className="pt-2 text-center text-xs text-slate-500">
            Contas administrativas são provisionadas apenas pelo desenvolvedor.
          </p>
        </form>
      </Card>
    </div>
  );
}
