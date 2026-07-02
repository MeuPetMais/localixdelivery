import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform-settings.functions";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Admin — Configurações da Plataforma" }] }),
  component: SettingsPage,
});

type Tier = { label: string; min: number; max: number | null; fee: number };
type CityFee = { city: string; fee: number };

type FormState = {
  name: string;
  logo_url: string;
  banner_url: string;
  primary_color: string;
  contact_email: string;
  contact_whatsapp: string;
  domain: string;
  commission_rate: number;
  fixed_fee: number;
  min_order: number;
  delivery_fee_default: number;
  tier_fees: Tier[];
  city_fees: CityFee[];
};

const empty: FormState = {
  name: "Localix Delivery", logo_url: "", banner_url: "", primary_color: "#f97316",
  contact_email: "", contact_whatsapp: "", domain: "",
  commission_rate: 0.05, fixed_fee: 0.99, min_order: 0, delivery_fee_default: 0,
  tier_fees: [], city_fees: [],
};

function SettingsPage() {
  const qc = useQueryClient();
  const load = useServerFn(getPlatformSettings);
  const save = useServerFn(updatePlatformSettings);
  const { data, isLoading } = useQuery({ queryKey: ["platform-settings"], queryFn: () => load() });
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name ?? "",
      logo_url: data.logo_url ?? "",
      banner_url: data.banner_url ?? "",
      primary_color: data.primary_color ?? "#f97316",
      contact_email: data.contact_email ?? "",
      contact_whatsapp: data.contact_whatsapp ?? "",
      domain: data.domain ?? "",
      commission_rate: Number(data.commission_rate ?? 0.05),
      fixed_fee: Number(data.fixed_fee ?? 0.99),
      min_order: Number(data.min_order ?? 0),
      delivery_fee_default: Number(data.delivery_fee_default ?? 0),
      tier_fees: Array.isArray(data.tier_fees) ? data.tier_fees as Tier[] : [],
      city_fees: Array.isArray(data.city_fees) ? data.city_fees as CityFee[] : [],
    });
  }, [data]);

  const mut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["platform-settings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(f => ({ ...f, [k]: v })); }

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Configurações da Plataforma</h1>
          <p className="text-sm text-slate-400">Ajuste comissão, taxas, contatos e identidade. Alterações de comissão valem apenas para pedidos novos.</p>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <Section title="Identidade">
        <Field label="Nome da plataforma"><Input value={form.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Logo (URL)"><Input value={form.logo_url} onChange={e => set("logo_url", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Banner (URL)"><Input value={form.banner_url} onChange={e => set("banner_url", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Cor primária">
          <div className="flex items-center gap-2">
            <input type="color" value={form.primary_color} onChange={e => set("primary_color", e.target.value)} className="h-10 w-14 rounded border border-slate-700 bg-slate-900" />
            <Input value={form.primary_color} onChange={e => set("primary_color", e.target.value)} />
          </div>
        </Field>
      </Section>

      <Section title="Contato">
        <Field label="E-mail"><Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} /></Field>
        <Field label="WhatsApp"><Input value={form.contact_whatsapp} onChange={e => set("contact_whatsapp", e.target.value)} placeholder="+55…" /></Field>
        <Field label="Domínio"><Input value={form.domain} onChange={e => set("domain", e.target.value)} placeholder="localixdelivery.com" /></Field>
      </Section>

      <Section title="Financeiro">
        <Field label="Comissão da plataforma (%)">
          <Input type="number" min={0} max={100} step={0.1}
            value={(form.commission_rate * 100).toFixed(2)}
            onChange={e => set("commission_rate", Math.max(0, Math.min(1, Number(e.target.value) / 100)))} />
        </Field>
        <Field label="Taxa fixa por pedido (R$)">
          <Input type="number" min={0} step={0.01} value={form.fixed_fee}
            onChange={e => set("fixed_fee", Number(e.target.value) || 0)} />
        </Field>
        <Field label="Pedido mínimo padrão (R$)">
          <Input type="number" min={0} step={0.01} value={form.min_order}
            onChange={e => set("min_order", Number(e.target.value) || 0)} />
        </Field>
        <Field label="Taxa de entrega padrão (R$)">
          <Input type="number" min={0} step={0.01} value={form.delivery_fee_default}
            onChange={e => set("delivery_fee_default", Number(e.target.value) || 0)} />
        </Field>
      </Section>

      <Section title="Taxa por faixa (distância / valor)">
        <div className="col-span-full space-y-2">
          {form.tier_fees.map((t, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
              <Input className="col-span-4" placeholder="Rótulo (ex: 0-3km)" value={t.label}
                onChange={e => set("tier_fees", form.tier_fees.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <Input className="col-span-2" type="number" step={0.01} placeholder="Mín" value={t.min}
                onChange={e => set("tier_fees", form.tier_fees.map((x, j) => j === i ? { ...x, min: Number(e.target.value) || 0 } : x))} />
              <Input className="col-span-2" type="number" step={0.01} placeholder="Máx (vazio = ∞)" value={t.max ?? ""}
                onChange={e => set("tier_fees", form.tier_fees.map((x, j) => j === i ? { ...x, max: e.target.value === "" ? null : Number(e.target.value) } : x))} />
              <Input className="col-span-3" type="number" step={0.01} placeholder="Taxa R$" value={t.fee}
                onChange={e => set("tier_fees", form.tier_fees.map((x, j) => j === i ? { ...x, fee: Number(e.target.value) || 0 } : x))} />
              <Button variant="ghost" size="icon" className="col-span-1"
                onClick={() => set("tier_fees", form.tier_fees.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm"
            onClick={() => set("tier_fees", [...form.tier_fees, { label: "", min: 0, max: null, fee: 0 }])}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar faixa
          </Button>
        </div>
      </Section>

      <Section title="Taxa por cidade">
        <div className="col-span-full space-y-2">
          {form.city_fees.map((c, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
              <Input className="col-span-8" placeholder="Cidade" value={c.city}
                onChange={e => set("city_fees", form.city_fees.map((x, j) => j === i ? { ...x, city: e.target.value } : x))} />
              <Input className="col-span-3" type="number" step={0.01} placeholder="Taxa R$" value={c.fee}
                onChange={e => set("city_fees", form.city_fees.map((x, j) => j === i ? { ...x, fee: Number(e.target.value) || 0 } : x))} />
              <Button variant="ghost" size="icon" className="col-span-1"
                onClick={() => set("city_fees", form.city_fees.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm"
            onClick={() => set("city_fees", [...form.city_fees, { city: "", fee: 0 }])}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar cidade
          </Button>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
