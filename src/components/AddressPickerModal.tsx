import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, MapPin, Star, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  listAddresses,
  upsertAddress,
  setDefaultAddress,
  deleteAddress,
  formatAddressLine,
  type CustomerAddress,
  type AddressInput,
} from "@/lib/customer-addresses";

type Mode = "list" | "form";

const EMPTY: AddressInput = {
  label: "Casa",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  notes: "",
};

export function AddressPickerModal({
  open,
  onOpenChange,
  userId,
  initialMode = "list",
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  initialMode?: Mode;
  onSelect?: (a: CustomerAddress) => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [editing, setEditing] = useState<Partial<CustomerAddress> | null>(null);
  const [form, setForm] = useState<AddressInput>(EMPTY);
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["customer-addresses", userId],
    enabled: open && !!userId,
    queryFn: () => listAddresses(userId),
  });

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEditing(null);
      setForm(EMPTY);
      setMakeDefault(false);
    }
  }, [open, initialMode]);

  function openForm(a?: CustomerAddress) {
    if (a) {
      setEditing(a);
      setForm({
        label: a.label,
        cep: a.cep ?? "",
        street: a.street,
        number: a.number ?? "",
        complement: a.complement ?? "",
        neighborhood: a.neighborhood,
        city: a.city ?? "",
        state: a.state ?? "",
        notes: a.notes ?? "",
      });
      setMakeDefault(a.is_default);
    } else {
      setEditing(null);
      setForm(EMPTY);
      setMakeDefault(addresses.length === 0);
    }
    setMode("form");
  }

  async function handleSave() {
    if (!form.street.trim() || !form.neighborhood.trim()) {
      toast.error("Preencha rua e bairro");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertAddress(userId, {
        ...form,
        id: editing?.id,
        is_default: makeDefault || (addresses.length === 0 && !editing),
      });
      qc.invalidateQueries({ queryKey: ["customer-addresses", userId] });
      toast.success(editing ? "Endereço atualizado" : "Endereço salvo");
      onSelect?.(saved);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultAddress(id);
      qc.invalidateQueries({ queryKey: ["customer-addresses", userId] });
      toast.success("Definido como principal");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este endereço?")) return;
    try {
      await deleteAddress(id);
      qc.invalidateQueries({ queryKey: ["customer-addresses", userId] });
      toast.success("Endereço excluído");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "list" ? "Meus endereços" : editing ? "Editar endereço" : "Novo endereço"}
          </DialogTitle>
          <DialogDescription>
            {mode === "list"
              ? "Selecione um endereço para entrega ou cadastre um novo."
              : "Seus endereços ficam salvos para próximos pedidos."}
          </DialogDescription>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : addresses.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum endereço salvo ainda.
              </p>
            ) : (
              addresses.map((a) => (
                <Card key={a.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      className="flex flex-1 items-start gap-3 text-left"
                      onClick={() => {
                        onSelect?.(a);
                        onOpenChange(false);
                      }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-semibold">
                          {a.label}
                          {a.is_default && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <Star className="h-2.5 w-2.5 fill-current" /> Principal
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{formatAddressLine(a)}</p>
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      {!a.is_default && (
                        <Button size="icon" variant="ghost" title="Tornar principal" onClick={() => handleSetDefault(a.id)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => openForm(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}

            <Button className="w-full" variant="outline" onClick={() => openForm()}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo endereço
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Apelido</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
                  placeholder="Casa, Trabalho, Namorada…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input value={form.cep ?? ""} onChange={(e) => setForm((s) => ({ ...s, cep: e.target.value }))} placeholder="00000-000" />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input value={form.number ?? ""} onChange={(e) => setForm((s) => ({ ...s, number: e.target.value }))} placeholder="123" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Rua *</Label>
                <Input value={form.street} onChange={(e) => setForm((s) => ({ ...s, street: e.target.value }))} placeholder="Rua das Flores" />
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input value={form.complement ?? ""} onChange={(e) => setForm((s) => ({ ...s, complement: e.target.value }))} placeholder="Apto 12" />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro *</Label>
                <Input value={form.neighborhood} onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))} placeholder="Centro" />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={form.city ?? ""} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} placeholder="São Paulo" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input value={form.state ?? ""} onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))} placeholder="SP" maxLength={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Portão azul, deixar na portaria…" />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
              />
              <Star className="h-4 w-4 text-primary" />
              Definir como endereço principal
            </label>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode("list")} disabled={saving}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
