// RC5.4 — Recuperação de senha do entregador (arquitetura placeholder).
// SMS/OTP não implementados nesta etapa.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestDriverPasswordReset } from "@/lib/driver-activation.functions";
import { DRIVER_PASSWORD_RESET_CONFIRMATION } from "@/lib/driver-auth";

export const Route = createFileRoute("/entregador/esqueci-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Recuperar senha — Localix Entregador" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const doRequest = useServerFn(requestDriverPasswordReset);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Telefone inválido");
    setLoading(true);
    try {
      await doRequest({ data: { phone } });
      setSent(true);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-md px-4 pt-10">
        <Link to="/entregador/ativar" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Localix Entregador</p>
            <p className="font-display text-lg font-extrabold leading-tight">Recuperar senha</p>
          </div>
        </div>

        <Card className="rounded-3xl border-none p-6 shadow-sm">
          {sent ? (
            <>
              <h2 className="font-display text-xl font-extrabold">Solicitação registrada</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {DRIVER_PASSWORD_RESET_CONFIRMATION.replace("Solicitação registrada.\n\n", "")}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Informe o telefone cadastrado pelo restaurante.
              </p>
              <div className="mt-4">
                <Label>Telefone</Label>
                <Input inputMode="tel" placeholder="(11) 90000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button className="mt-6 w-full rounded-2xl" onClick={submit} disabled={loading}>
                {loading ? "Enviando..." : "Solicitar recuperação"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
