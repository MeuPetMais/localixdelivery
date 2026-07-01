import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/format";

const DRAFT_KEY = "localix.onboarding.draft";

type Draft = {
  name?: string;
  slug?: string;
  slugTouched?: boolean;
  whatsapp?: string;
  ownerName?: string;
  description?: string;
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : {};
  } catch {
    return {};
  }
}
function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {}
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function OwnerOnboarding({
  ownerId,
  onCreated,
}: {
  ownerId: string;
  onCreated: () => Promise<unknown> | void;
}) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill: (1) signup metadata + auth email, then (2) local draft overrides.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      const meta = (u?.user_meta_data ?? u?.user_metadata ?? {}) as Record<string, string>;
      const draft = loadDraft();

      const initialName = draft.name ?? meta.store_name ?? "";
      const initialOwner = draft.ownerName ?? meta.owner_name ?? "";
      const initialWa = draft.whatsapp ?? meta.whatsapp ?? "";
      const initialSlug = draft.slug ?? slugify(initialName);

      setEmail(u?.email ?? "");
      setName(initialName);
      setOwnerName(initialOwner);
      setWhatsapp(initialWa);
      setSlug(initialSlug);
      setSlugTouched(!!draft.slugTouched);
      setDescription(draft.description ?? "");
      setReady(true);
    })();
  }, []);

  // Persist draft on every change.
  useEffect(() => {
    if (!ready) return;
    saveDraft({ name, slug, slugTouched, whatsapp, ownerName, description });
  }, [ready, name, slug, slugTouched, whatsapp, ownerName, description]);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const baseSlug = slugify(slug) || slugify(name) || `loja-${ownerId.slice(0, 6)}`;
    let finalSlug = baseSlug;
    let adjusted = false;
    let inserted = false;
    let lastErr: unknown = null;

    for (let attempt = 2; attempt <= 20; attempt++) {
      const { error } = await supabase.from("restaurants").insert({
        owner_id: ownerId,
        name,
        slug: finalSlug,
        whatsapp_phone: whatsapp,
        owner_name: ownerName || null,
        description: description || null,
      });
      if (!error) {
        inserted = true;
        break;
      }
      lastErr = error;
      if (error.code === "23505") {
        finalSlug = `${baseSlug}-${attempt}`;
        adjusted = true;
        continue;
      }
      break;
    }

    if (!inserted) {
      setLoading(false);
      const e = lastErr as { message?: string } | null;
      toast.error(e?.message || "Falha ao criar estabelecimento.");
      return;
    }

    // Save owner profile (non-blocking)
    if (ownerName) {
      await supabase
        .from("owner_profiles")
        .upsert(
          { id: ownerId, full_name: ownerName, phone: whatsapp || null },
          { onConflict: "id" },
        );
    }

    clearDraft();
    setLoading(false);

    if (adjusted) {
      toast.info("Sua URL foi ajustada automaticamente porque já existia outra igual.", {
        duration: 6000,
      });
    }
    toast.success("Restaurante criado!");
    await onCreated();
  }

  if (!ready) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const readyToSubmit = !!(name && slug && whatsapp);

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="p-8">
        <h1 className="font-display text-2xl font-extrabold">Vamos criar seu Localix 🍔</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Já preenchemos com os dados do seu cadastro. Confira e finalize.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome do estabelecimento</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Pizzaria do Zé"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="owner">Nome do responsável</Label>
            <Input
              id="owner"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="José da Silva"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp para receber pedidos</Label>
            <Input
              id="wa"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              E-mail <Lock className="h-3 w-3 text-muted-foreground" />
            </Label>
            <Input id="email" value={email} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Este é o e-mail usado no seu login e não pode ser editado agora.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">URL pública</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                className="border-0 bg-transparent focus-visible:ring-0"
                placeholder="pizzaria-do-ze"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Gerada automaticamente a partir do nome. Se já existir, ajustamos para uma disponível.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição curta (opcional)</Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="As melhores pizzas artesanais do bairro."
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !readyToSubmit}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Criar meu Localix
          </Button>
        </form>
      </Card>
    </div>
  );
}
