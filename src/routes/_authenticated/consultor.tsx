import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { consultorChat, getMyRestaurantId } from "@/lib/consultor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles, Bot, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/consultor")({
  head: () => ({ meta: [{ title: "Consultor IA — Localix" }] }),
  component: ConsultorPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Como aumentar meu faturamento?",
  "Qual produto devo promover esta semana?",
  "Onde estou perdendo lucro?",
  "Qual horário gera mais vendas?",
  "Quais clientes devo reativar?",
  "Meu estoque está saudável?",
];

function ConsultorPage() {
  const fetchRest = useServerFn(getMyRestaurantId);
  const chat = useServerFn(consultorChat);
  const { data: rest } = useQuery({ queryKey: ["my-restaurant"], queryFn: () => fetchRest() });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!rest?.id) {
      toast.error("Cadastre seu restaurante primeiro.");
      return;
    }
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chat({ data: { restaurantId: rest.id, messages: next.slice(-20) } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no consultor");
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Não consegui responder agora. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-warm text-primary-foreground shadow-glow">
              <Sparkles className="h-5 w-5" />
            </span>
            Consultor IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Chat inteligente com acesso completo aos dados do seu restaurante.
          </p>
        </div>
      </div>

      <Card className="flex h-[calc(100vh-260px)] min-h-[480px] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-md space-y-4">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Pergunte qualquer coisa sobre o seu negócio</h2>
                  <p className="text-sm text-muted-foreground">Pedidos, CRM, fidelidade, estoque, financeiro e marketing — tudo conectado.</p>
                </div>
                <div className="grid gap-2 text-left sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border bg-card p-3 text-sm transition hover:border-primary/50 hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-gradient-warm text-primary-foreground shadow-glow"}`}>
                {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-warm text-primary-foreground shadow-glow">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-muted px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t bg-background p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Quais clientes inativos devo recuperar primeiro?"
            disabled={loading}
            autoFocus
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
