import { createFileRoute, redirect } from "@tanstack/react-router";

// A tela "Meus Benefícios" foi unificada em /fidelidade → "Minha Carteira".
// Mantemos a rota apenas para redirecionar quem tinha o link salvo.
export const Route = createFileRoute("/beneficios")({
  beforeLoad: () => {
    throw redirect({ to: "/fidelidade" });
  },
  component: () => null,
});
