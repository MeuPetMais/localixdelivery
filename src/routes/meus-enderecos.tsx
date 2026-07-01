import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, MapPin, Plus, Star, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { AddressPickerModal } from "@/components/AddressPickerModal";
import {
  listAddresses,
  setDefaultAddress,
  deleteAddress,
  formatAddressLine,
  type CustomerAddress,
} from "@/lib/customer-addresses";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/meus-enderecos")({
  head: () => ({ meta: [{ title: "Meus Endereços — Localix" }] }),
  component: MyAddressesPage,
});

function MyAddressesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useCustomerAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["customer-addresses", user?.id],
    enabled: !!user?.id,
    queryFn: () => listAddresses(user!.id),
  });

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="font-display text-2xl font-bold">Entre para ver seus endereços</h1>
        <Button onClick={() => navigate({ to: "/cliente" })}>Fazer login</Button>
      </div>
    );
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultAddress(id);
      qc.invalidateQueries({ queryKey: ["customer-addresses", user!.id] });
      toast.success("Definido como principal");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este endereço?")) return;
    try {
      await deleteAddress(id);
      qc.invalidateQueries({ queryKey: ["customer-addresses", user!.id] });
      toast.success("Endereço excluído");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/cliente"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-lg font-extrabold">Meus Endereços</h1>
            <p className="text-xs text-muted-foreground">Cadastre e gerencie seus locais de entrega</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-6">
        <Button
          className="w-full"
          onClick={() => { setEditingId(null); setPickerOpen(true); }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Novo endereço
        </Button>

        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : addresses.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum endereço cadastrado.
          </Card>
        ) : (
          addresses.map((a: CustomerAddress) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold">
                      {a.label}
                      {a.is_default && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          <Star className="h-2.5 w-2.5 fill-current" /> Principal
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatAddressLine(a)}</p>
                    {(a.city || a.state) && (
                      <p className="text-xs text-muted-foreground">
                        {[a.city, a.state].filter(Boolean).join("/")}
                      </p>
                    )}
                    {a.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{a.notes}"</p>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!a.is_default && (
                  <Button size="sm" variant="outline" onClick={() => handleSetDefault(a.id)}>
                    <Star className="mr-1 h-3.5 w-3.5" /> Tornar principal
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setEditingId(a.id); setPickerOpen(true); }}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" /> Excluir
                </Button>
              </div>
            </Card>
          ))
        )}
      </main>

      <AddressPickerModal
        open={pickerOpen}
        onOpenChange={(v) => { setPickerOpen(v); if (!v) setEditingId(null); }}
        userId={user.id}
        initialMode={editingId ? "list" : "form"}
      />
    </div>
  );
}
