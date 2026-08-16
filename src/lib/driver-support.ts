export const DRIVER_HELP_ROUTE = "/entregador/ajuda";
export const DRIVER_SUPPORT_WHATSAPP_ENV = "VITE_LOCALIX_SUPPORT_WHATSAPP";

export type DriverSupportProfile = {
  name?: string | null;
};

export type DriverFaqItem = {
  question: string;
  answer: string;
};

export type DriverFaqSection = {
  title: string;
  items: DriverFaqItem[];
};

export const DRIVER_SUPPORT_BASE_MESSAGE = "Olá! Sou entregador do Localix e preciso de ajuda.";

export const DRIVER_FAQ_SECTIONS: DriverFaqSection[] = [
  {
    title: "Acesso ao aplicativo",
    items: [
      {
        question: "Como instalar novamente o Localix Entregador?",
        answer:
          "Acesse o Localix Entregador pelo navegador, faça login e use a opção de instalação disponível na área Perfil ou no próprio navegador.",
      },
      {
        question: "Esqueci minha senha. O que faço?",
        answer:
          "Use o fluxo Esqueci minha senha na entrada do entregador. Se o acesso foi criado pelo estabelecimento, você também pode solicitar um novo acesso ao restaurante.",
      },
      {
        question: "Troquei de celular. Preciso criar outra conta?",
        answer: "Não. Use a mesma conta de entregador já cadastrada para entrar no novo celular.",
      },
    ],
  },
  {
    title: "Entregas",
    items: [
      {
        question: "Como recebo uma nova entrega?",
        answer:
          "Quando você está online e na fila do restaurante, o Localix pode atribuir uma entrega para você. A entrega aparece na tela inicial do app do motoboy.",
      },
      {
        question: "Como aceitar uma entrega?",
        answer:
          "No fluxo atual, a entrega atribuída aparece como novo pedido e você usa o botão Retirar pedido para iniciar a coleta e sair para a entrega.",
      },
      {
        question: "O que acontece depois que retiro o pedido?",
        answer:
          "Depois de retirar o pedido, a entrega fica em andamento. Ao concluir no endereço do cliente, toque em Pedido entregue. Em seguida, o app orienta seu retorno ao restaurante.",
      },
    ],
  },
  {
    title: "Localização",
    items: [
      {
        question: "Por que o Localix precisa da minha localização?",
        answer:
          "A localização é usada para funcionalidades operacionais de entrega quando o recurso está ativo, como acompanhar disponibilidade, entrega em andamento e retorno ao restaurante.",
      },
      {
        question: "Minha localização não atualiza. O que faço?",
        answer:
          "Confira se a permissão de localização está ativa, se o GPS está ligado, se a conexão está funcionando, reabra o aplicativo e verifique se há atualização disponível.",
      },
    ],
  },
  {
    title: "Ganhos e carteira",
    items: [
      {
        question: "Onde vejo meus ganhos?",
        answer:
          "Use as abas Carteira, Extrato e Stats do app do motoboy para acompanhar ganhos, histórico de entregas e estatísticas.",
      },
      {
        question: "Quando meus ganhos são atualizados?",
        answer:
          "Os ganhos são exibidos a partir das entregas concluídas como Entregue e aparecem nos totais do dia, semana, mês e ano.",
      },
    ],
  },
  {
    title: "Documentos",
    items: [
      {
        question: "Como envio meus documentos?",
        answer:
          "Acesse Perfil e use a área Documentos para enviar foto do perfil, CNH e comprovante de endereço.",
      },
      {
        question: "Posso trocar um documento já enviado?",
        answer:
          "Sim. Quando um documento já foi enviado, a interface mostra a ação Trocar para substituir o arquivo.",
      },
    ],
  },
  {
    title: "Aplicativo",
    items: [
      {
        question: "Como verificar se existe atualização?",
        answer: "Acesse Perfil -> Aplicativo -> Verificar atualização.",
      },
      {
        question: "O aplicativo não abre corretamente. O que fazer?",
        answer:
          "Verifique sua internet, feche e abra o aplicativo novamente, confira se há atualização e, se necessário, reinstale o PWA pelo navegador.",
      },
    ],
  },
];

export function normalizeWhatsAppPhone(value: string | null | undefined): string | null {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits || /^55\d{2}9{9}$/.test(digits)) return null;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function buildDriverSupportMessage(profile?: DriverSupportProfile): string {
  const lines = [DRIVER_SUPPORT_BASE_MESSAGE];
  const name = profile?.name?.trim();
  if (name) lines.push(`Nome: ${name}`);
  return lines.join("\n");
}

export function buildDriverSupportWhatsAppUrl(
  phone: string | null | undefined,
  profile?: DriverSupportProfile,
): string | null {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return null;
  const text = encodeURIComponent(buildDriverSupportMessage(profile));
  return `https://wa.me/${normalizedPhone}?text=${text}`;
}

export function getConfiguredDriverSupportWhatsApp(env: Record<string, unknown>): string | null {
  const value = env[DRIVER_SUPPORT_WHATSAPP_ENV];
  return typeof value === "string" ? normalizeWhatsAppPhone(value) : null;
}

export function filterDriverFaqSections(
  query: string,
  sections = DRIVER_FAQ_SECTIONS,
): DriverFaqSection[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalizedQuery) return sections;

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const haystack = `${section.title} ${item.question} ${item.answer}`.toLocaleLowerCase(
          "pt-BR",
        );
        return haystack.includes(normalizedQuery);
      }),
    }))
    .filter((section) => section.items.length > 0);
}
