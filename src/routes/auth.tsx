import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { slugify } from "@/lib/format";
import { resolvePostLoginRedirect } from "@/lib/admin-mode";
import { toastArgsFromAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Localix Delivery" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "signup" ? "signup" : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = forgotEmail.trim();
    if (!trimmed) {
      toast.error("Informe seu e-mail");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("E-mail inválido");
      return;
    }
    setForgotSending(true);
    if (import.meta.env.DEV) {
      console.info("[auth-debug] resetPasswordForEmail:start", {
        ts: new Date().toISOString(),
        email: trimmed,
        redirectTo: `${window.location.origin}/redefinir-senha`,
        screen: "/auth (forgot dialog)",
      });
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (import.meta.env.DEV) {
        const e = error as { code?: string; status?: number; message?: string } | null;
        console.info("[auth-debug] resetPasswordForEmail:return", {
          ok: !error,
          errorCode: e?.code,
          errorStatus: e?.status,
          errorMessage: e?.message,
        });
      }
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      // Não revelar existência de conta — apenas exibir mensagem genérica em erros não críticos
      setForgotSent(true);
      if (import.meta.env.DEV) console.error("[auth-debug] resetPasswordForEmail:catch", err);
    } finally {
      setForgotSending(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const dest = await resolvePostLoginRedirect(data.session.user.id);
        navigate({ to: dest, replace: true });
      }
    });
  }, [navigate]);

  // DEV-only: log form input attributes + detect autofill on password field
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const pwd = document.getElementById("pwd") as HTMLInputElement | null;
    const em = document.getElementById("email") as HTMLInputElement | null;
    console.info("[auth-debug] form:mount", {
      tab,
      emailInput: em ? { name: em.name, autocomplete: em.autocomplete } : null,
      passwordInput: pwd ? { name: pwd.name, autocomplete: pwd.autocomplete } : null,
    });
    if (!pwd) return;
    let last = pwd.value;
    const iv = window.setInterval(() => {
      if (pwd.value !== last) {
        const source = document.activeElement === pwd ? "user-typing" : "autofill/password-manager";
        console.warn("[auth-debug] password:changed", {
          tab,
          length: pwd.value.length,
          reactStateLength: password.length,
          reactStateMatches: pwd.value === password,
          source,
        });
        last = pwd.value;
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [tab, password]);

  function notifyAuthError(context: string, err: unknown) {
    const [title, opts] = toastArgsFromAuthError(err, context);
    toast.error(title, opts);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        if (import.meta.env.DEV) {
          console.info("[auth-debug] signUp:before", {
            ts: new Date().toISOString(),
            email,
            passwordLength: password.length,
            screen: "/auth (signup tab)",
          });
        }
        console.info("[signup] start: auth.signUp");
        // Persist onboarding draft so the "Criar seu Localix" screen comes
        // pre-filled even if email confirmation is required (no session yet).
        try {
          localStorage.setItem(
            "localix.onboarding.draft",
            JSON.stringify({
              name: storeName,
              slug: slugify(storeName),
              slugTouched: false,
              whatsapp,
              ownerName,
            }),
          );
        } catch {
          void 0;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              account_type: "partner",
              kind: "partner",
              owner_name: ownerName,
              store_name: storeName,
              whatsapp,
              cnpj: cnpj || null,
            },
          },
        });
        if (import.meta.env.DEV) {
          const er = error as { code?: string; status?: number; message?: string } | null;
          console.info("[auth-debug] signUp:after", {
            ok: !error,
            userId: data?.user?.id,
            hasSession: !!data?.session,
            errorCode: er?.code,
            errorStatus: er?.status,
            errorMessage: er?.message,
          });
        }
        if (error) {
          notifyAuthError("signUp", error);
          return;
        }
        console.info("[signup] auth.signUp ok", {
          userId: data.user?.id,
          hasSession: !!data.session,
        });

        const userId = data.user?.id;
        if (!userId) {
          toast.error("auth.signUp não retornou usuário.");
          return;
        }

        // Se a confirmação de e-mail está ativa, não há sessão — o INSERT em restaurants
        // será bloqueado pelo RLS (auth.uid() = owner_id). Informe o usuário.
        if (!data.session) {
          toast.success(
            "Conta criada! Confirme seu e-mail para concluir o cadastro do estabelecimento.",
            { duration: 8000 },
          );
          return;
        }

        console.info("[signup] start: insert restaurants");
        const baseSlug = slugify(storeName) || `loja-${userId.slice(0, 6)}`;
        let finalSlug = baseSlug;
        let adjusted = false;
        let insertOk = false;
        let lastErr: unknown = null;
        for (let attempt = 2; attempt <= 20; attempt++) {
          const { error: insErr } = await supabase.from("restaurants").insert({
            owner_id: userId,
            name: storeName,
            slug: finalSlug,
            whatsapp_phone: whatsapp,
            owner_name: ownerName,
            cnpj: cnpj || null,
          });
          if (!insErr) {
            insertOk = true;
            break;
          }
          lastErr = insErr;
          if (insErr.code === "23505") {
            finalSlug = `${baseSlug}-${attempt}`;
            adjusted = true;
            continue;
          }
          break;
        }
        if (!insertOk) {
          console.error("[signup] insert restaurants falhou", lastErr);
          toast.error("Não foi possível concluir o cadastro", {
            description:
              "Sua conta foi criada, mas não conseguimos criar o estabelecimento. Tente novamente em instantes.",
            duration: 10000,
          });
          return;
        }
        // Save owner profile (best-effort)
        await supabase
          .from("owner_profiles")
          .upsert(
            { id: userId, full_name: ownerName, phone: whatsapp || null },
            { onConflict: "id" },
          );
        try {
          localStorage.removeItem("localix.onboarding.draft");
        } catch {
          void 0;
        }
        console.info("[signup] insert restaurants ok", { slug: finalSlug });
        if (adjusted) {
          toast.info("Sua URL foi ajustada automaticamente porque já existia outra igual.", {
            duration: 6000,
          });
        }
        toast.success("Conta criada! Painel pronto.");
        navigate({ to: "/dashboard", replace: true });
      } else {
        if (import.meta.env.DEV) {
          console.info("[auth-debug] signInWithPassword:before", {
            ts: new Date().toISOString(),
            email,
            passwordLength: password.length,
            screen: "/auth (signin tab)",
          });
        }
        const { error, data: signInData } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (import.meta.env.DEV) {
          const er = error as { code?: string; status?: number; message?: string } | null;
          console.info("[auth-debug] signInWithPassword:after", {
            ok: !error,
            userId: signInData?.user?.id,
            hasSession: !!signInData?.session,
            errorCode: er?.code,
            errorStatus: er?.status,
            errorMessage: er?.message,
          });
        }
        if (error) {
          notifyAuthError("signIn", error);
          return;
        }
        const dest = signInData.user
          ? await resolvePostLoginRedirect(signInData.user.id)
          : "/dashboard";
        navigate({ to: dest, replace: true });
      }
    } catch (err) {
      notifyAuthError("inesperado", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-extrabold"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-warm text-primary-foreground shadow-glow">
            L
          </span>
          Localix
        </Link>
        <Card className="p-6 shadow-glow">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "signin" | "signup");
              setPassword("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-6 space-y-4">
              <h1 className="font-display text-2xl font-bold">Bem-vindo de volta</h1>
              <p className="text-sm text-muted-foreground">Acesse o painel do seu restaurante.</p>
            </TabsContent>
            <TabsContent value="signup" className="mt-6 space-y-4">
              <h1 className="font-display text-2xl font-bold">Cadastre seu estabelecimento</h1>
              <p className="text-sm text-muted-foreground">
                Painel criado automaticamente. Sem cartão de crédito.
              </p>
              <ul className="grid grid-cols-1 gap-1.5 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-2">
                {[
                  "Cadastro 100% gratuito",
                  "Sem mensalidade na validação",
                  "URL própria do estabelecimento",
                  "Cardápio digital completo",
                  "Pedidos online via WhatsApp",
                  "Programa de fidelidade",
                  "Promoções e cupons",
                  "Monte do Seu Jeito",
                  "Central de IA inclusa",
                  "Marketplace exclusivo de parceiros",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-1.5">
                    <span className="text-success">✓</span> {b}
                  </li>
                ))}
              </ul>
            </TabsContent>

            <form onSubmit={handleEmail} className="mt-4 space-y-3">
              {tab === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="store">Nome do estabelecimento</Label>
                    <Input
                      id="store"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Pizzaria do Zé"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner">Nome do responsável</Label>
                    <Input
                      id="owner"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="José da Silva"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa">WhatsApp</Label>
                    <Input
                      id="wa"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+55 11 99999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj">
                      CNPJ <span className="text-xs text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="cnpj"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@restaurante.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd">Senha</Label>
                <PasswordInput
                  key={tab === "signup" ? "pwd-signup" : "pwd-signin"}
                  id="pwd"
                  name={tab === "signup" ? "new-password" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                />
              </div>
              {tab === "signin" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotSent(false);
                      setForgotOpen(true);
                    }}
                    className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tab === "signup" ? "Criar conta" : "Entrar"}
              </Button>
            </form>
          </Tabs>
        </Card>
        <Link
          to="/"
          className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para o site
        </Link>
      </div>

      <Dialog
        open={forgotOpen}
        onOpenChange={(o) => {
          setForgotOpen(o);
          if (!o) {
            setForgotSent(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar acesso</DialogTitle>
            <DialogDescription>
              Informe o e-mail cadastrado e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          {forgotSent ? (
            <div className="space-y-4">
              <p className="rounded-md bg-muted/60 p-3 text-sm">
                Se existir uma conta vinculada a este e-mail, enviamos um link para redefinição da
                senha.
              </p>
              <DialogFooter>
                <Button type="button" className="w-full" onClick={() => setForgotOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="voce@restaurante.com"
                  autoFocus
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotOpen(false)}
                  disabled={forgotSending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={forgotSending}>
                  {forgotSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {forgotSending ? "Enviando..." : "Enviar link"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
