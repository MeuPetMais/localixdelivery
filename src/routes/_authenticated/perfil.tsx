import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Camera,
  Trash2,
  UserCircle,
  ShieldCheck,
  Settings as SettingsIcon,
  CreditCard,
  Monitor,
  Copy,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — Localix" }] }),
  component: MyProfilePage,
});

type OwnerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role_title: string | null;
  avatar_url: string | null;
  language: string;
  theme: string;
  email_notifications: boolean;
  push_notifications: boolean;
  marketing_optin: boolean;
  created_at: string;
};

async function uploadAvatar(file: File, userId: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `owners/${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("restaurant-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = await supabase.storage
    .from("restaurant-assets")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  return data?.signedUrl ?? null;
}

function MyProfilePage() {
  const { user } = Route.useRouteContext() as {
    user: { id: string; email?: string; created_at?: string; last_sign_in_at?: string };
  };

  const { data: profile, refetch } = useQuery({
    queryKey: ["owner-profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("owner_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return (data ?? null) as OwnerProfile | null;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState("pt-BR");
  const [theme, setTheme] = useState("auto");
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [marketing, setMarketing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setRoleTitle(profile.role_title ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
    setLanguage(profile.language ?? "pt-BR");
    setTheme(profile.theme ?? "auto");
    setEmailNotif(profile.email_notifications);
    setPushNotif(profile.push_notifications);
    setMarketing(profile.marketing_optin);
  }, [profile]);

  async function persist(payload: Partial<OwnerProfile>) {
    const { error } = await supabase
      .from("owner_profiles")
      .upsert({ id: user.id, ...payload }, { onConflict: "id" });
    if (error) throw error;
  }

  async function handleSavePersonal() {
    setSaving(true);
    try {
      await persist({
        full_name: fullName || null,
        phone: phone || null,
        role_title: roleTitle || null,
      });
      toast.success("Informações pessoais atualizadas");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePrefs() {
    setSaving(true);
    try {
      await persist({
        language,
        theme,
        email_notifications: emailNotif,
        push_notifications: pushNotif,
        marketing_optin: marketing,
      });
      toast.success("Preferências atualizadas");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(file: File) {
    setUploading(true);
    try {
      const url = await uploadAvatar(file, user.id);
      setAvatarUrl(url);
      await persist({ avatar_url: url });
      toast.success("Foto atualizada");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

  async function handleAvatarRemove() {
    setUploading(true);
    try {
      setAvatarUrl(null);
      await persist({ avatar_url: null });
      toast.success("Foto removida");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    } finally {
      setUploading(false);
    }
  }

  async function handleChangeEmail() {
    if (!newEmail) return;
    setSecurityBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Enviamos um link de confirmação para o novo e-mail");
      setNewEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar e-mail");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    setSecurityBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso");
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleSignOutOthers() {
    setSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success("Sessões em outros dispositivos encerradas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao encerrar sessões");
    } finally {
      setSigningOutOthers(false);
    }
  }

  function copyAccountId() {
    navigator.clipboard.writeText(user.id);
    toast.success("ID copiado");
  }

  const initials = (fullName || user.email || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browser = /Chrome\/[\d.]+/.test(ua)
    ? "Chrome"
    : /Safari\/[\d.]+/.test(ua)
      ? "Safari"
      : /Firefox\/[\d.]+/.test(ua)
        ? "Firefox"
        : /Edg\/[\d.]+/.test(ua)
          ? "Edge"
          : "Navegador";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : "Desconhecido";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Meu Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados pessoais do proprietário da conta. Não afeta as informações do estabelecimento.
        </p>
      </header>

      {/* Informações pessoais */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Informações pessoais</h2>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border bg-muted text-2xl font-bold text-muted-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarChange(f);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {avatarUrl ? "Trocar" : "Enviar"}
              </Button>
              {avatarUrl && (
                <Button size="sm" variant="ghost" onClick={handleAvatarRemove} disabled={uploading}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={user.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Cargo / Função</Label>
              <Input id="role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Proprietário" />
            </div>
            <div className="space-y-1.5">
              <Label>Conta criada em</Label>
              <Input value={user.created_at ? new Date(user.created_at).toLocaleString("pt-BR") : "—"} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Último acesso</Label>
              <Input value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "—"} disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ID da conta</Label>
              <div className="flex gap-2">
                <Input value={user.id} disabled className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyAccountId}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSavePersonal} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar informações
          </Button>
        </div>
      </Card>

      {/* Segurança */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Segurança</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="newEmail">Alterar e-mail</Label>
            <div className="flex gap-2">
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@email.com"
              />
              <Button onClick={handleChangeEmail} disabled={securityBusy || !newEmail}>
                Atualizar
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPwd">Alterar senha</Label>
            <div className="flex gap-2">
              <PasswordInput
                id="newPwd"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha"
                autoComplete="new-password"
                minLength={6}
              />
              <Button onClick={handleChangePassword} disabled={securityBusy || !newPassword}>
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Encerrar sessões em outros dispositivos</p>
            <p className="text-xs text-muted-foreground">
              Mantém esta sessão ativa e desconecta todas as outras.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOutOthers} disabled={signingOutOthers}>
            {signingOutOthers ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Encerrar outras
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Último login: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "—"}
        </p>
      </Card>

      {/* Preferências */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Preferências</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="es-ES">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tema</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {[
            { id: "email", label: "Notificações por e-mail", value: emailNotif, set: setEmailNotif },
            { id: "push", label: "Notificações push", value: pushNotif, set: setPushNotif },
            { id: "mkt", label: "Receber novidades da plataforma", value: marketing, set: setMarketing },
          ].map((opt) => (
            <div key={opt.id} className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor={opt.id} className="cursor-pointer">{opt.label}</Label>
              <Switch id={opt.id} checked={opt.value} onCheckedChange={opt.set} />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSavePrefs} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar preferências
          </Button>
        </div>
      </Card>

      {/* Minha assinatura */}
      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Minha assinatura</h2>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
          <Badge className="mb-2">Período de validação</Badge>
          <p className="text-sm font-semibold">
            Você está utilizando gratuitamente todas as funcionalidades da Localix.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Em breve disponibilizaremos planos com cobrança recorrente e histórico de pagamentos.
          </p>
        </div>
      </Card>

      {/* Sessões / Dispositivos */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Dispositivos conectados</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {browser} · {os}
                <Badge variant="secondary" className="ml-2">Esta sessão</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Último acesso: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={handleSignOutOthers} disabled={signingOutOthers}>
            {signingOutOthers ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Encerrar outras sessões
          </Button>
        </div>
      </Card>
    </div>
  );
}
