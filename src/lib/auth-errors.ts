// Traduz erros do Supabase Auth em mensagens amigáveis ao usuário final.
// Detalhes técnicos permanecem apenas nos logs (console).

export interface FriendlyAuthError {
  title: string;
  message: string;
}

interface RawAuthError {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
}

const WEAK_PASSWORD: FriendlyAuthError = {
  title: "Senha muito fraca",
  message:
    "Sua senha é muito fácil de adivinhar. Escolha uma senha mais segura contendo:\n" +
    "• pelo menos 8 caracteres;\n" +
    "• uma letra maiúscula;\n" +
    "• uma letra minúscula;\n" +
    "• um número;\n" +
    "• um caractere especial.",
};

const GENERIC: FriendlyAuthError = {
  title: "Não foi possível concluir",
  message: "Tente novamente em instantes.",
};

export function translateAuthError(err: unknown, context?: string): FriendlyAuthError {
  // Sempre registrar o erro técnico completo para diagnóstico.
  try {
    console.error(`[auth${context ? `:${context}` : ""}]`, err);
  } catch {}

  const e = (err ?? {}) as RawAuthError;
  const code = (e.code ?? "").toLowerCase();
  const msg = (e.message ?? "").toLowerCase();
  const status = e.status;

  // Rede
  if (
    e.name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    code === "network_error"
  ) {
    return {
      title: "Sem conexão",
      message: "Não foi possível conectar. Verifique sua internet e tente novamente.",
    };
  }

  // Senha fraca (HIBP / weak_password)
  if (
    code === "weak_password" ||
    msg.includes("weak") ||
    msg.includes("password is known to be weak") ||
    msg.includes("pwned")
  ) {
    return WEAK_PASSWORD;
  }

  // E-mail já cadastrado
  if (
    code === "email_already_exists" ||
    code === "user_already_exists" ||
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  ) {
    return {
      title: "E-mail já cadastrado",
      message: "Já existe uma conta cadastrada com este e-mail.",
    };
  }

  // E-mail inválido
  if (code === "invalid_email" || msg.includes("invalid email") || msg.includes("unable to validate email")) {
    return { title: "E-mail inválido", message: "Informe um e-mail válido." };
  }

  // Confirmação de e-mail pendente
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return {
      title: "E-mail não confirmado",
      message: "Confirme seu e-mail antes de entrar.",
    };
  }

  // Credenciais incorretas
  if (
    code === "invalid_login_credentials" ||
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials")
  ) {
    return {
      title: "Credenciais inválidas",
      message: "E-mail ou senha incorretos.",
    };
  }

  // Rate limit
  if (
    code === "too_many_requests" ||
    code === "over_request_rate_limit" ||
    status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many")
  ) {
    return {
      title: "Muitas tentativas",
      message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    };
  }

  return GENERIC;
}

/** Formata para uso com sonner: `toast.error(title, { description })`. */
export function toastArgsFromAuthError(err: unknown, context?: string): [string, { description: string }] {
  const t = translateAuthError(err, context);
  return [t.title, { description: t.message }];
}
