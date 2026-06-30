import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { slugify } from "@/lib/format";

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
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      // Não revelar existência de conta — apenas exibir mensagem genérica em erros não críticos
      setForgotSent(true);
      console.error(err);
    } finally {
      setForgotSending(false);
    }
  }


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { owner_name: ownerName, store_name: storeName },
          },
        });
        if (error) throw error;
        const userId = data.user?.id;
        if (userId) {
          // Create restaurant panel automatically
          const baseSlug = slugify(storeName) || `loja-${userId.slice(0, 6)}`;
          let finalSlug = baseSlug;
          for (let i = 0; i < 5; i++) {
            const { error: insErr } = await supabase.from("restaurants").insert({
              owner_id: userId,
              name: storeName,
              slug: finalSlug,
              whatsapp_phone: whatsapp,
              owner_name: ownerName,
              cnpj: cnpj || null,
            });
            if (!insErr) break;
            if (insErr.code === "23505") {
              finalSlug = `${baseSlug}-${Math.floor(Math.random() * 9000 + 1000)}`;
              continue;
            }
            throw insErr;
          }
        }
        toast.success("Conta criada! Painel pronto.");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-extrabold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-warm text-primary-foreground shadow-glow">L</span>
          Localix
        </Link>
        <Card className="p-6 shadow-glow">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
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
              <p className="text-sm text-muted-foreground">Painel criado automaticamente. Sem cartão de crédito.</p>
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
                    <Input id="store" required value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Pizzaria do Zé" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner">Nome do responsável</Label>
                    <Input id="owner" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="José da Silva" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wa">WhatsApp</Label>
                    <Input id="wa" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+55 11 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj">CNPJ <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                    <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@restaurante.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd">Senha</Label>
                <PasswordInput id="pwd" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={tab === "signup" ? "new-password" : "current-password"} />
              </div>
              {tab === "signin" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setForgotSent(false); setForgotOpen(true); }}
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
        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">← Voltar para o site</Link>
      </div>

      <Dialog open={forgotOpen} onOpenChange={(o) => { setForgotOpen(o); if (!o) { setForgotSent(false); } }}>
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
                Se existir uma conta vinculada a este e-mail, enviamos um link para redefinição da senha.
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
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)} disabled={forgotSending}>
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

