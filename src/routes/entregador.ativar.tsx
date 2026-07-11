// RC5.4 — Ativação da conta do entregador (público)
// Wizard: Bem-vindo → Validação (CPF+Telefone) → Confirmação → Criar acesso → Home.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, User, Lock, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  validateDriverActivation, activateDriverAccount,
} from "@/lib/driver-activation.functions";

export const Route = createFileRoute("/entregador/ativar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ativar conta — Localix Entregador" },
      { name: "description", content: "Ative sua conta e comece a fazer entregas." },
    ],
  }),
  component: ActivateDriver,
});

type Match = {
  driverId: string; name: string; restaurantName: string;
  vehicleType: string; vehiclePlate: string | null;
};

function ActivateDriver() {
  const nav = useNavigate();
  const doValidate = useServerFn(validateDriverActivation);
  const doActivate = useServerFn(activateDriverAccount);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  const progress = step === 1 ? 10 : step === 2 ? 35 : step === 3 ? 65 : 100;

  async function handleValidate() {
    if (cpf.replace(/\D/g, "").length < 11) return toast.error("CPF inválido");
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Telefone inválido");
    setLoading(true);
    try {
      const res = await doValidate({ data: { cpf, phone } });
      if (!res.found) {
        toast.error("Não encontramos seu cadastro. Confirme com o restaurante que te cadastrou.");
        return;
      }
      setMatch({
        driverId: res.driverId!, name: res.name!,
        restaurantName: res.restaurantName!,
        vehicleType: res.vehicleType!, vehiclePlate: res.vehiclePlate ?? null,
      });
      setStep(3);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleActivate() {
    if (pw.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (pw !== pw2) return toast.error("As senhas não coincidem");
    setLoading(true);
    try {
      const res = await doActivate({
        data: { cpf, phone, password: pw, email: email.trim() || null },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: res.email, password: pw,
      });
      if (error) throw error;
      setStep(4);
      setTimeout(() => nav({ to: "/motoboy" }), 1500);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  const pwStrength = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s; // 0..4
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-md px-4 pt-10 pb-16">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Localix Entregador</p>
            <p className="font-display text-lg font-extrabold leading-tight">Ativação da conta</p>
          </div>
        </div>
        <Progress value={progress} className="mb-6 h-1.5" />

        {step === 1 && (
          <Card className="rounded-3xl border-none p-6 shadow-sm">
            <h1 className="font-display text-2xl font-extrabold">Bem-vindo ao Localix Entregador</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Você foi cadastrado por um restaurante parceiro. Vamos ativar sua conta.
            </p>
            <Button className="mt-6 w-full rounded-2xl" onClick={() => setStep(2)}>
              Começar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card className="rounded-3xl border-none p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> Vamos confirmar seu cadastro
            </div>
            <div className="space-y-3">
              <div>
                <Label>CPF</Label>
                <Input inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input inputMode="tel" placeholder="(11) 90000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button className="flex-1 rounded-2xl" onClick={handleValidate} disabled={loading}>
                {loading ? "Buscando..." : "Continuar"}
              </Button>
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Não compartilhamos seus dados. Se não encontrarmos seu cadastro,
              procure o restaurante que te contratou.
            </p>
          </Card>
        )}

        {step === 3 && match && (
          <Card className="rounded-3xl border-none p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 text-primary" /> Confirme seus dados
            </div>
            <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
              <Row label="Nome" value={match.name} />
              <Row label="Restaurante" value={match.restaurantName} />
              <Row label="Veículo" value={match.vehicleType} />
              {match.vehiclePlate && <Row label="Placa" value={match.vehiclePlate} />}
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-primary" /> Criar acesso
              </div>
              <div>
                <Label>E-mail <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Input type="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" placeholder="Mínimo 8 caracteres" value={pw} onChange={(e) => setPw(e.target.value)} />
                <div className="mt-1 flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded ${i < pwStrength ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>
              </div>
              <div>
                <Label>Confirmar senha</Label>
                <Input type="password" placeholder="Repita a senha" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button className="flex-1 rounded-2xl" onClick={handleActivate} disabled={loading}>
                {loading ? "Ativando..." : "Ativar conta"}
              </Button>
            </div>
          </Card>
        )}

        {step === 4 && match && (
          <Card className="rounded-3xl border-none p-8 text-center shadow-sm">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-extrabold">Bem-vindo, {match.name.split(" ")[0]}!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você está vinculado a <strong>{match.restaurantName}</strong>.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Redirecionando para sua Home…</p>
          </Card>
        )}

        <div className="mt-6 text-center">
          <a href="/entregador/esqueci-senha" className="text-xs text-muted-foreground underline underline-offset-4">
            Esqueci minha senha
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
