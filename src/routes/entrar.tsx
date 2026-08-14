import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Gift, Heart, Ticket, History, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { useCustomerNavigation } from "@/contexts/CustomerNavigationContext";
import { toastArgsFromAuthError } from "@/lib/auth-errors";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

const RESERVED_TOP = new Set([
  "",
  "home",
  "inicio",
  "beneficios",
  "favoritos",
  "meus-pedidos",
  "cliente",
  "pedido",
  "pedido-sucesso",
  "auth",
  "entrar",
  "esqueci-senha",
  "redefinir-senha",
  "admin",
  "dashboard",
  "menu",
  "orders",
  "settings",
  "ai",
  "consultor",
  "customers",
  "finance",
  "finance-ai",
  "inventory",
  "loyalty",
  "promotions",
  "reviews",
  "suppliers",
  "units",
  "builders",
  "r",
  "api",
]);

function validRestaurantRedirect(path?: string | null) {
  if (!path || !path.startsWith("/") || path === "/") return null;
  const slug = path.split(/[?#]/)[0]?.split("/")[1] ?? "";
  if (!slug || slug.includes(".") || RESERVED_TOP.has(slug)) return null;
  return { path: `/${slug}`, slug };
}

function readStoredLoginRedirect() {
  try {
    return sessionStorage.getItem("postLoginRedirect");
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/entrar")({
  head: () => ({ meta: [{ title: "Entrar — Localix Delivery" }] }),
  validateSearch: searchSchema,
  component: CustomerAuthPage,
});

function CustomerAuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/entrar" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "google" | "apple" | "email">(null);
  const { currentRestaurantSlug, lastRestaurantSlug, prepareLoginRedirect } =
    useCustomerNavigation();

  useEffect(() => {
    let redirected = false;
    const redirectIfAuthenticated = (session: unknown) => {
      if (!session || redirected) return;
      redirected = true;
      goNext();
    };

    supabase.auth.getSession().then(({ data }) => {
      redirectIfAuthenticated(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (import.meta.env.DEV)
        console.info("[auth-debug] onAuthStateChange(entrar)", {
          event: _event,
          hasSession: !!session,
          userId: session?.user?.id,
        });
      redirectIfAuthenticated(session);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getRestaurantLoginTarget() {
    const fromSearch = validRestaurantRedirect(search.redirect);
    if (fromSearch) return fromSearch;

    const fromStored = validRestaurantRedirect(readStoredLoginRedirect());
    if (fromStored) return fromStored;

    const slug = currentRestaurantSlug ?? lastRestaurantSlug;
    if (slug) return { path: `/${slug}`, slug };

    return null;
  }

  function persistLoginTarget() {
    const target = getRestaurantLoginTarget();
    if (target) return prepareLoginRedirect(target.slug);
    return null;
  }

  function goNext() {
    const target = getRestaurantLoginTarget();
    try {
      sessionStorage.removeItem("postLoginRedirect");
    } catch {
      void 0;
    }
    if (target?.slug) {
      navigate({ to: "/$slug", params: { slug: target.slug }, replace: true });
      return;
    }
    navigate({ to: "/cliente", replace: true });
  }

  function goBack() {
    const target = getRestaurantLoginTarget();
    if (target?.slug) {
      navigate({ to: "/$slug", params: { slug: target.slug }, replace: true });
      return;
    }
    navigate({ to: "/cliente", replace: true });
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(provider);
    const redirectPath = persistLoginTarget();
    if (!redirectPath) {
      toast.error("Abra o link do restaurante antes de entrar.");
      setLoading(null);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + "/entrar",
      },
    });

    if (error) {
      toast.error(`Não foi possível entrar com ${provider === "google" ? "Google" : "Apple"}`);
      setLoading(null);
      return;
    }

    // O Supabase faz o redirecionamento automaticamente.
    // Se não houve erro, não execute goNext().
    return;
  }
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    const redirectPath = persistLoginTarget();
    if (!redirectPath) {
      toast.error("Abra o link do restaurante antes de entrar.");
      setLoading(null);
      return;
    }
    try {
      if (import.meta.env.DEV)
        console.info("[auth-debug] signInWithPassword:before", {
          ts: new Date().toISOString(),
          email,
          passwordLength: password.length,
          screen: "/entrar",
        });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (import.meta.env.DEV) {
        const er = error as { code?: string; status?: number; message?: string } | null;
        console.info("[auth-debug] signInWithPassword:after", {
          ok: !error,
          userId: data?.user?.id,
          hasSession: !!data?.session,
          errorCode: er?.code,
          errorStatus: er?.status,
          errorMessage: er?.message,
        });
      }
      if (error || !data.session)
        throw (
          error ?? new Error("Não foi possível iniciar sua sessão. Tente entrar com seu e-mail.")
        );
      goNext();
    } catch (err) {
      const [title, opts] = toastArgsFromAuthError(err, "signIn");
      toast.error(title, opts);
    } finally {
      setLoading(null);
    }
  }

  const isBusy = loading !== null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <button
          onClick={goBack}
          className="mb-4 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-warm text-primary-foreground shadow-glow">
            <span className="font-display text-2xl font-extrabold">L</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold">Acesse sua conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre em segundos e desbloqueie benefícios
          </p>
        </div>

        <Card className="space-y-3 p-5 shadow-xl">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-center gap-3 rounded-xl border-2 text-base font-semibold"
            onClick={() => handleOAuth("google")}
            disabled={isBusy}
          >
            {loading === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
            Continuar com Google
          </Button>

          <Button
            type="button"
            className="h-12 w-full justify-center gap-3 rounded-xl bg-black text-base font-semibold text-white hover:bg-black/90"
            onClick={() => handleOAuth("apple")}
            disabled={isBusy}
          >
            {loading === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleIcon />}
            Continuar com Apple
          </Button>

          <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd">Senha</Label>
              <PasswordInput
                id="pwd"
                name="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={isBusy}>
              {loading === "email" && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </Button>

            <Link
              to="/esqueci-senha"
              className="block text-center text-sm text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </form>
        </Card>

        <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <Benefit icon={<Gift className="h-4 w-4" />} label="Cashback e fidelidade" />
          <Benefit icon={<Ticket className="h-4 w-4" />} label="Cupons exclusivos" />
          <Benefit icon={<History className="h-4 w-4" />} label="Histórico de pedidos" />
          <Benefit icon={<Heart className="h-4 w-4" />} label="Restaurantes favoritos" />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Você também pode pedir como visitante, sem cadastro.
        </p>
      </div>
    </div>
  );
}

function Benefit({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/50 p-2.5">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v3.2h5.07c-.22 1.28-1.62 3.74-5.07 3.74-3.05 0-5.54-2.53-5.54-5.64s2.49-5.64 5.54-5.64c1.74 0 2.9.74 3.57 1.38l2.43-2.34C16.42 4.36 14.4 3.5 12 3.5c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5c4.9 0 8.14-3.44 8.14-8.28 0-.56-.06-.98-.13-1.42H12z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.22-1.26 3.06-.84.84-2.04 1.5-3.18 1.5-.06-1.14.48-2.28 1.26-3.06.84-.84 2.1-1.5 3.18-1.5zm4.5 17.4c-.66 1.5-1.5 3-2.76 4.2-1.08.96-2.16 1.92-3.78 1.92s-2.04-1.02-3.84-1.02-2.34 1.02-3.84 1.02-2.7-.96-3.78-2.04C.51 19.05-.39 15.39.93 12.81c.96-1.92 2.7-3.18 4.62-3.18 1.5 0 2.94 1.02 3.84 1.02.84 0 2.7-1.26 4.56-1.08.78 0 2.94.3 4.32 2.34-3.78 2.04-3.18 7.32 2.6 6.92z" />
    </svg>
  );
}
