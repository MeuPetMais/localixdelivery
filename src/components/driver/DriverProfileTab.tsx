// RC6.8 — Perfil do Entregador
// UI de perfil completo: dados pessoais, veículo, documentos, segurança,
// app (PWA + verificar atualização), suporte e logout.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bike, Camera, ChevronRight, FileText, IdCard, LogOut, RefreshCw,
  Save, LifeBuoy, Lock, Upload, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { updateMyDriverProfile } from "@/lib/delivery-drivers.functions";
import { uploadDriverAsset, type DriverAssetKind } from "@/lib/driver-upload";
import { PwaInstallButton } from "@/components/driver/PwaInstallModal";
import { checkForDriverAppUpdate } from "@/lib/pwa-driver-update";
import {
  buildDriverSupportWhatsAppUrl,
  getConfiguredDriverSupportWhatsApp,
} from "@/lib/driver-support";

type Driver = {
  id: string;
  restaurant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  photo_url: string | null;
  vehicle_type: string;
  vehicle_model?: string | null;
  vehicle_plate: string | null;
  cnh_url?: string | null;
  address_proof_url?: string | null;
  document_url?: string | null;
  status: string;
  created_at: string;
};

const VEHICLE_LABEL: Record<string, string> = {
  moto: "Moto",
  bicicleta: "Bicicleta",
  carro: "Carro",
  a_pe: "A pé",
};

export function DriverProfileTab(props: { driver: Driver }) {
  const d = props.driver;
  const qc = useQueryClient();
  const update = useServerFn(updateMyDriverProfile);

  const [name, setName] = useState(d.name ?? "");
  const [phone, setPhone] = useState(d.phone ?? "");
  const [cpf, setCpf] = useState(d.cpf ?? "");
  const [vehicleType, setVehicleType] = useState(d.vehicle_type ?? "moto");
  const [vehicleModel, setVehicleModel] = useState(d.vehicle_model ?? "");
  const [vehiclePlate, setVehiclePlate] = useState(d.vehicle_plate ?? "");
  const [photoUrl, setPhotoUrl] = useState(d.photo_url ?? "");
  const [cnhUrl, setCnhUrl] = useState(d.cnh_url ?? d.document_url ?? "");
  const [addressProofUrl, setAddressProofUrl] = useState(d.address_proof_url ?? "");

  const [changePassOpen, setChangePassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const supportPhone = getConfiguredDriverSupportWhatsApp(import.meta.env);
  const supportUrl = buildDriverSupportWhatsAppUrl(supportPhone, { name });

  const days = useMemo(
    () => Math.max(0, Math.round((Date.now() - new Date(d.created_at).getTime()) / 86400000)),
    [d.created_at],
  );

  const saveMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) => update({ data: { patch } }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["driver-wallet"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function handleUpload(kind: DriverAssetKind, file: File) {
    try {
      const url = await uploadDriverAsset(file, d.restaurant_id, kind);
      if (kind === "photo") {
        setPhotoUrl(url);
        await saveMut.mutateAsync({ photo_url: url });
      } else if (kind === "cnh") {
        setCnhUrl(url);
        await saveMut.mutateAsync({ cnh_url: url });
      } else {
        setAddressProofUrl(url);
        await saveMut.mutateAsync({ address_proof_url: url });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function savePersonal() {
    if (name.trim().length < 2) return toast.error("Informe seu nome completo");
    saveMut.mutate({
      name: name.trim(),
      phone: phone.trim() || null,
      cpf: cpf.trim() || null,
    });
  }

  function saveVehicle() {
    saveMut.mutate({
      vehicle_type: vehicleType,
      vehicle_model: vehicleModel.trim() || null,
      vehicle_plate: vehiclePlate.trim() || null,
    });
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem");
    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword(""); setConfirmPassword(""); setChangePassOpen(false);
      toast.success("Senha alterada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChanging(false);
    }
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    try {
      const r = await checkForDriverAppUpdate();
      if (r === "updated") toast.success("Novo conteúdo disponível. Recarregue o app.");
      else if (r === "current") toast.success("Você já está na versão mais recente.");
      else toast.message("Verificação de atualização indisponível neste ambiente.");
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <div className="animate-in fade-in space-y-4 pb-4">
      {/* Header */}
      <Card className="flex flex-col items-center rounded-3xl border-none p-6 shadow-sm">
        <label className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full bg-muted">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-muted-foreground">
              {(name || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
            <Camera className="h-6 w-6" />
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Alterar foto de perfil"
            onChange={(e) => e.target.files?.[0] && handleUpload("photo", e.target.files[0])}
          />
        </label>
        <p className="mt-3 font-display text-xl font-extrabold">{name || "—"}</p>
        <p className="text-xs text-muted-foreground">{d.email ?? "—"}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{d.status}</Badge>
          <Badge variant="secondary">{days} dia(s) na plataforma</Badge>
        </div>
      </Card>

      {/* Dados pessoais */}
      <Section icon={<User className="h-4 w-4" />} title="Dados pessoais">
        <Field label="Nome completo">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Telefone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="(11) 90000-0000" />
        </Field>
        <Field label="CPF">
          <Input value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} placeholder="000.000.000-00" />
        </Field>
        <Button className="w-full rounded-2xl" onClick={savePersonal} disabled={saveMut.isPending}>
          <Save className="mr-2 h-4 w-4" /> Salvar dados
        </Button>
      </Section>

      {/* Veículo */}
      <Section icon={<Bike className="h-4 w-4" />} title="Veículo">
        <Field label="Tipo">
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Tipo de veículo"
          >
            {Object.entries(VEHICLE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Modelo">
          <Input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Ex.: Honda CG 160" maxLength={80} />
        </Field>
        <Field label="Placa">
          <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} placeholder="AAA-0A00" maxLength={20} />
        </Field>
        <Button className="w-full rounded-2xl" onClick={saveVehicle} disabled={saveMut.isPending}>
          <Save className="mr-2 h-4 w-4" /> Salvar veículo
        </Button>
      </Section>

      {/* Documentos */}
      <Section icon={<FileText className="h-4 w-4" />} title="Documentos">
        <DocRow
          icon={<Camera className="h-4 w-4" />} label="Foto do perfil"
          hasFile={!!photoUrl} url={photoUrl}
          onFile={(f) => handleUpload("photo", f)}
        />
        <DocRow
          icon={<IdCard className="h-4 w-4" />} label="CNH"
          hasFile={!!cnhUrl} url={cnhUrl}
          onFile={(f) => handleUpload("cnh", f)}
        />
        <DocRow
          icon={<FileText className="h-4 w-4" />} label="Comprovante de endereço"
          hasFile={!!addressProofUrl} url={addressProofUrl}
          onFile={(f) => handleUpload("document", f)}
        />
      </Section>

      {/* Segurança */}
      <Section icon={<Lock className="h-4 w-4" />} title="Segurança">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-semibold"
          onClick={() => setChangePassOpen((o) => !o)}
          aria-expanded={changePassOpen}
        >
          Alterar senha
          <ChevronRight className={`h-4 w-4 transition-transform ${changePassOpen ? "rotate-90" : ""}`} />
        </button>
        {changePassOpen && (
          <div className="mt-3 space-y-3">
            <Field label="Nova senha">
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmar nova senha">
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
            </Field>
            <Button className="w-full rounded-2xl" onClick={handleChangePassword} disabled={changing}>
              <Save className="mr-2 h-4 w-4" /> {changing ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </div>
        )}
      </Section>

      {/* Aplicativo */}
      <Section icon={<RefreshCw className="h-4 w-4" />} title="Aplicativo">
        <PwaInstallButton />
        <Button
          variant="outline"
          className="w-full rounded-2xl"
          onClick={handleCheckUpdate}
          disabled={checkingUpdate}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${checkingUpdate ? "animate-spin" : ""}`} />
          {checkingUpdate ? "Verificando..." : "Verificar atualização"}
        </Button>
      </Section>

      {/* Suporte */}
      <Section icon={<LifeBuoy className="h-4 w-4" />} title="Suporte">
        <Link
          className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-sm hover:bg-muted"
          to="/entregador/ajuda"
        >
          Perguntas frequentes (FAQ)
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        {supportUrl ? (
          <a
            className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-sm hover:bg-muted"
            href={supportUrl}
            target="_blank" rel="noreferrer"
          >
            Falar com o suporte
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </a>
        ) : (
          <button
            type="button"
            className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-left text-sm text-muted-foreground"
            disabled
          >
            <span className="flex min-w-0 flex-col">
              <span>Falar com o suporte</span>
              <span className="text-xs font-normal">Suporte temporariamente indisponível</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </Section>

      <Button variant="outline" className="w-full rounded-2xl" onClick={() => supabase.auth.signOut()}>
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

function Section(props: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-none p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{props.icon}</span>
        {props.title}
      </div>
      <div className="space-y-3">{props.children}</div>
    </Card>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      {props.children}
    </div>
  );
}

function DocRow(props: {
  icon: React.ReactNode; label: string; hasFile: boolean; url: string;
  onFile: (f: File) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-muted-foreground">{props.icon}</span>
        <span className="truncate">{props.label}</span>
        {props.hasFile ? (
          <Badge variant="secondary" className="ml-1">Enviado</Badge>
        ) : (
          <Badge variant="outline" className="ml-1">Pendente</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {props.hasFile && (
          <a
            href={props.url} target="_blank" rel="noreferrer"
            className="text-xs text-muted-foreground underline"
          >Ver</a>
        )}
        <label className="cursor-pointer">
          <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-input px-3 text-xs font-medium hover:bg-muted">
            <Upload className="h-3 w-3" /> {props.hasFile ? "Trocar" : "Enviar"}
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            aria-label={`Enviar ${props.label}`}
            onChange={(e) => e.target.files?.[0] && props.onFile(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  );
}
