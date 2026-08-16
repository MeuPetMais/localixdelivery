import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, LifeBuoy, Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { filterDriverFaqSections } from "@/lib/driver-support";

export const Route = createFileRoute("/entregador/ajuda")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Central de Ajuda - Localix Entregador" },
      {
        name: "description",
        content: "Encontre respostas rápidas sobre o Localix Entregador.",
      },
    ],
  }),
  component: DriverHelpPage,
});

function DriverHelpPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const sections = useMemo(() => filterDriverFaqSections(query), [query]);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate({ to: "/motoboy" });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-md px-4 pb-10 pt-5">
        <div className="mb-5 flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={goBack}
            aria-label="Voltar para o perfil"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Localix Entregador
            </p>
            <h1 className="font-display text-2xl font-extrabold leading-tight">Central de Ajuda</h1>
          </div>
        </div>

        <Card className="rounded-3xl border-none p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Encontre respostas rápidas sobre o Localix Entregador.
            </p>
          </div>

          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar na ajuda"
              className="h-11 rounded-2xl pl-9"
              aria-label="Buscar na ajuda"
            />
          </div>
        </Card>

        <div className="mt-4 space-y-4">
          {sections.length === 0 ? (
            <Card className="rounded-2xl border-none p-6 text-center text-sm text-muted-foreground shadow-sm">
              Nenhuma resposta encontrada.
            </Card>
          ) : (
            sections.map((section) => (
              <Card key={section.title} className="rounded-2xl border-none p-4 shadow-sm">
                <h2 className="mb-1 text-sm font-bold">{section.title}</h2>
                <Accordion type="single" collapsible className="w-full">
                  {section.items.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger className="py-3 text-left text-sm font-semibold no-underline hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            ))
          )}
        </div>

        <Button asChild variant="outline" className="mt-5 w-full rounded-2xl">
          <Link to="/motoboy">Voltar para Perfil</Link>
        </Button>
      </div>
    </main>
  );
}
