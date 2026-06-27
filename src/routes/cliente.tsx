import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Loader2,
  Heart,
  Tag,
  Sparkles,
  History,
  MapPin,
  Zap,
  Mail,
  LogOut,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/cliente")({
  head: () => ({ meta: [{ title: "Minha Conta — Localix" }] }),
  component: MinhaContaPage,
});

function MinhaContaPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return user ? <ProfileView user={user} /> : <AuthView />;
}

const BENEFITS = [
  { icon: Heart, label: "Favoritos", desc: "Salve seus restaurantes" },
  { icon: Tag, label: "Promoções", desc: "Cupons exclusivos" },
  { icon: Sparkles, label: "Fidelidade", desc: "Acumule pontos" },
  { icon: History, label: "Histórico", desc: "Todos os pedidos" },
  { icon: MapPin, label: "Endereços", desc: "Salvos com segurança" },
  { icon: Zap, label: "Checkout rápido", desc: "Peça em 1 toque" },
];

function getRestaurantReturnPath(): string | null {
  try {
    const slug = sessionStorage.getItem("localix:last-restaurant-slug");
    if (slug) return `/${slug}`;
  } catch {}
  return null;
}

function AuthView() {
  const [loading, setLoading] = useState<null | "google" | "apple">(null);
  const returnPath = getRestaurantReturnPath();
  const emailRedirect = returnPath ?? "/cliente";

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(provider);
    try {
      if (returnPath) sessionStorage.setItem("postLoginRedirect", returnPath);
    } catch {}
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + (returnPath ?? "/cliente"),
    });
    if (result.error) {
      toast.error(`Não foi possível entrar com ${provider === "google" ? "Google" : "Apple"}`);
      setLoading(null);
      return;
    }
    if (result.redirected) return;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-warm text-primary-foreground shadow-glow">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Minha Conta</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Entre para desbloquear vantagens exclusivas e pedir mais rápido nos seus restaurantes favoritos.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-2">
          {BENEFITS.map((b) => (
            <Card key={b.label} className="flex flex-col items-center gap-1.5 p-3 text-center">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <b.icon className="h-4 w-4" />
              </span>
              <p className="text-xs font-semibold leading-tight">{b.label}</p>
              <p className="text-[10px] leading-tight text-muted-foreground">{b.desc}</p>
            </Card>
          ))}
        </div>

        <Card className="space-y-3 p-5 shadow-xl">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-center gap-3 rounded-xl border-2 text-base font-semibold"
            onClick={() => handleOAuth("google")}
            disabled={loading !== null}
          >
            {loading === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
            Continuar com Google
          </Button>

          <Button
            type="button"
            className="h-12 w-full justify-center gap-3 rounded-xl bg-black text-base font-semibold text-white hover:bg-black/90"
            onClick={() => handleOAuth("apple")}
            disabled={loading !== null}
          >
            {loading === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleIcon />}
            Continuar com Apple
          </Button>

          <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
          </div>

          <Button asChild variant="secondary" className="h-12 w-full justify-center gap-2 rounded-xl text-base font-semibold">
            <Link to="/entrar" search={{ redirect: emailRedirect }}>
              <Mail className="h-5 w-5" /> Entrar com e-mail
            </Link>
          </Button>

          <div className="flex flex-col gap-1 pt-1 text-center text-sm">
            <Link to="/entrar" search={{ redirect: emailRedirect }} className="font-semibold text-primary hover:underline">
              Criar uma conta
            </Link>
            <Link to="/esqueci-senha" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Esqueci minha senha
            </Link>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prefere não criar conta? Você pode pedir como visitante em qualquer restaurante.
        </p>
      </div>
    </div>
  );
}

function ProfileView({ user }: { user: User }) {
  const navigate = useNavigate();
  const meta = (user.user_metadata ?? {}) as Record<string, any>;
  const name = meta.full_name || meta.name || user.email?.split("@")[0] || "Cliente";
  const avatar = meta.avatar_url || meta.picture;
  const initials = name
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/home" });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 ring-2 ring-primary/20">
              {avatar && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="bg-gradient-warm font-display text-lg font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Bem-vindo(a)</p>
              <h1 className="font-display text-xl font-extrabold leading-tight">{name}</h1>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card className="bg-gradient-warm p-5 text-primary-foreground shadow-glow">
          <p className="text-sm opacity-90">Sua conta está ativa</p>
          <p className="mt-1 font-display text-2xl font-extrabold">Aproveite todos os benefícios</p>
          <p className="mt-1 text-sm opacity-90">Favoritos, cupons e pedidos sincronizados em qualquer dispositivo.</p>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ProfileLink to="/favoritos" icon={Heart} label="Favoritos" />
          <ProfileLink to="/beneficios" icon={Tag} label="Cupons & Pontos" />
          <ProfileLink to="/meus-pedidos" icon={History} label="Meus Pedidos" />
          <ProfileLink to="/home" icon={Zap} label="Pedir agora" />
        </div>

        <Card className="p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Sessão segura</p>
          <p className="mt-1">Sua sessão fica ativa por até 30 dias neste dispositivo. Saia a qualquer momento pelo botão acima.</p>
        </Card>
      </main>
    </div>
  );
}

function ProfileLink({ to, icon: Icon, label }: { to: string; icon: typeof Heart; label: string }) {
  return (
    <Link to={to as any} className="group">
      <Card className="flex items-center justify-between p-4 transition-all group-hover:border-primary/40 group-hover:shadow-md">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <span className="font-semibold">{label}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 11v3.2h5.07c-.22 1.28-1.62 3.74-5.07 3.74-3.05 0-5.54-2.53-5.54-5.64s2.49-5.64 5.54-5.64c1.74 0 2.9.74 3.57 1.38l2.43-2.34C16.42 4.36 14.4 3.5 12 3.5c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5c4.9 0 8.14-3.44 8.14-8.28 0-.56-.06-.98-.13-1.42H12z" />
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
