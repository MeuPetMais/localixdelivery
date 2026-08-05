import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, BookOpen, Eye, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listKnowledgeArticlesAdmin,
  saveKnowledgeArticleAdmin,
  updateKnowledgeArticleStatusAdmin,
} from "@/lib/support-admin.functions";
import { CATEGORY_LABEL, SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support-admin";
import { sanitizeSupportText } from "@/lib/support-operations";

export const Route = createFileRoute("/admin/knowledge")({
  head: () => ({ meta: [{ title: "Admin - Base de Conhecimento" }] }),
  component: AdminKnowledgePage,
});

type Article = {
  id: string;
  title: string;
  content: string;
  category: string;
  video_url: string | null;
  position: number;
  published: boolean;
  archived: boolean;
  updated_at: string;
};

type FormState = {
  id?: string;
  title: string;
  content: string;
  category: string;
  videoUrl: string;
  position: number;
  published: boolean;
};

const emptyForm: FormState = {
  title: "",
  content: "",
  category: "problema_tecnico",
  videoUrl: "",
  position: 0,
  published: false,
};

function AdminKnowledgePage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listKnowledgeArticlesAdmin);
  const saveFn = useServerFn(saveKnowledgeArticleAdmin);
  const statusFn = useServerFn(updateKnowledgeArticleStatusAdmin);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [preview, setPreview] = useState<Article | FormState | null>(null);

  const articlesQuery = useQuery({
    queryKey: ["admin-knowledge", search, includeArchived],
    queryFn: () => listFn({ data: { search, includeArchived } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-knowledge"] });
  const save = useMutation({
    mutationFn: (payload: FormState) =>
      saveFn({
        data: {
          id: payload.id,
          title: payload.title,
          content: payload.content,
          category: payload.category,
          videoUrl: payload.videoUrl.trim() || null,
          position: payload.position,
          published: payload.published,
        },
      }),
    onSuccess: () => {
      toast.success("Artigo salvo");
      setForm(null);
      refresh();
    },
    onError: (error: any) => toast.error(error?.message ?? "Falha ao salvar artigo"),
  });
  const changeStatus = useMutation({
    mutationFn: (payload: { id: string; published?: boolean; archived?: boolean }) => statusFn({ data: payload }),
    onSuccess: refresh,
    onError: (error: any) => toast.error(error?.message ?? "Falha ao atualizar artigo"),
  });

  const articles = (articlesQuery.data ?? []) as Article[];
  const activeCount = useMemo(() => articles.filter((article) => article.published && !article.archived).length, [articles]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-5 w-5 text-primary" />
            Base de Conhecimento
          </h1>
          <p className="text-sm text-slate-400">Artigos persistidos usados nas sugestoes e na area /support.</p>
        </div>
        <Button className="gap-2" onClick={() => setForm(emptyForm)}>
          <Plus className="h-4 w-4" />
          Novo artigo
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Artigos" value={articles.length} />
        <Metric label="Publicados" value={activeCount} tone="green" />
        <Metric label="Arquivados visiveis" value={includeArchived ? articles.filter((article) => article.archived).length : 0} />
      </div>

      <Card className="border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por titulo, categoria ou conteudo"
              className="border-slate-700 bg-slate-950 pl-9 text-slate-100"
            />
          </div>
          <Button variant="outline" className="border-slate-700 text-slate-200" onClick={() => setIncludeArchived((value) => !value)}>
            {includeArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
          </Button>
        </div>
      </Card>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <div className="grid grid-cols-[80px_1.3fr_160px_130px_120px_220px] gap-3 border-b border-slate-800 bg-slate-800/50 px-4 py-3 text-xs font-semibold uppercase text-slate-400">
          <span>Ordem</span>
          <span>Titulo</span>
          <span>Categoria</span>
          <span>Status</span>
          <span>Atualizado</span>
          <span>Acoes</span>
        </div>
        {articlesQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando artigos...</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum artigo encontrado.</div>
        ) : articles.map((article) => (
          <div key={article.id} className="grid grid-cols-[80px_1.3fr_160px_130px_120px_220px] gap-3 border-b border-slate-800 px-4 py-3 text-sm last:border-0">
            <span className="text-slate-300">{article.position}</span>
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-100">{article.title}</div>
              <div className="truncate text-xs text-slate-400">{sanitizeSupportText(article.content, 120)}</div>
            </div>
            <span className="truncate text-slate-300">{categoryLabel(article.category)}</span>
            <Status article={article} />
            <span className="text-slate-400">{new Date(article.updated_at).toLocaleDateString("pt-BR")}</span>
            <div className="flex flex-wrap gap-1.5">
              <IconButton label="Previa" onClick={() => setPreview(article)}><Eye className="h-4 w-4" /></IconButton>
              <IconButton label="Editar" onClick={() => setForm(toForm(article))}><Pencil className="h-4 w-4" /></IconButton>
              <Button size="sm" variant="outline" className="h-8 border-slate-700 text-slate-200" onClick={() => changeStatus.mutate({ id: article.id, published: !article.published })}>
                {article.published ? "Despublicar" : "Publicar"}
              </Button>
              <IconButton label="Arquivar" onClick={() => changeStatus.mutate({ id: article.id, archived: true })}><Archive className="h-4 w-4" /></IconButton>
            </div>
          </div>
        ))}
      </div>

      <ArticleEditor
        form={form}
        onClose={() => setForm(null)}
        onPreview={(value) => setPreview(value)}
        onChange={setForm}
        onSave={() => form && save.mutate(form)}
        saving={save.isPending}
      />
      <PreviewDialog article={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" }) {
  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "green" ? "text-emerald-300" : "text-slate-100"}`}>{value}</div>
    </Card>
  );
}

function Status({ article }: { article: Article }) {
  if (article.archived) return <Badge className="border-slate-700 bg-slate-800 text-slate-300">Arquivado</Badge>;
  return article.published
    ? <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-200">Publicado</Badge>
    : <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-200">Rascunho</Badge>;
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <Button size="icon" variant="outline" className="h-8 w-8 border-slate-700 text-slate-200" title={label} onClick={onClick}>
      {children}
    </Button>
  );
}

function ArticleEditor({
  form,
  onClose,
  onPreview,
  onChange,
  onSave,
  saving,
}: {
  form: FormState | null;
  onClose: () => void;
  onPreview: (article: FormState) => void;
  onChange: (form: FormState) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!form) return null;
  return (
    <Dialog open={!!form} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar artigo" : "Novo artigo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Titulo">
            <Input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} className="border-slate-700 bg-slate-950 text-slate-100" />
          </Field>
          <div className="grid gap-3 md:grid-cols-[1fr_120px_150px]">
            <Field label="Categoria">
              <Select value={form.category} onValueChange={(value) => onChange({ ...form, category: value })}>
                <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{CATEGORY_LABEL[category]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ordem">
              <Input type="number" value={form.position} onChange={(event) => onChange({ ...form, position: Number(event.target.value) || 0 })} className="border-slate-700 bg-slate-950 text-slate-100" />
            </Field>
            <Field label="Publicacao">
              <Select value={form.published ? "published" : "draft"} onValueChange={(value) => onChange({ ...form, published: value === "published" })}>
                <SelectTrigger className="border-slate-700 bg-slate-950 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="URL de video ou referencia">
            <Input value={form.videoUrl} onChange={(event) => onChange({ ...form, videoUrl: event.target.value })} className="border-slate-700 bg-slate-950 text-slate-100" />
          </Field>
          <Field label="Conteudo">
            <Textarea value={form.content} rows={10} onChange={(event) => onChange({ ...form, content: event.target.value })} className="border-slate-700 bg-slate-950 text-slate-100" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-slate-700 text-slate-200" onClick={() => onPreview(form)}>Previa</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ article, onClose }: { article: Article | FormState | null; onClose: () => void }) {
  return (
    <Dialog open={!!article} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-slate-100">
        <DialogHeader><DialogTitle>Previa do artigo</DialogTitle></DialogHeader>
        {article && (
          <div className="space-y-3">
            <div>
              <Badge className="mb-2 border-slate-700 bg-slate-800 text-slate-200">{categoryLabel(article.category)}</Badge>
              <h2 className="text-xl font-bold">{article.title}</h2>
            </div>
            <div className="whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">{sanitizeSupportText(article.content)}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function toForm(article: Article): FormState {
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    category: article.category,
    videoUrl: article.video_url ?? "",
    position: article.position,
    published: article.published,
  };
}

function categoryLabel(category: string) {
  return CATEGORY_LABEL[category as SupportCategory] ?? category;
}
