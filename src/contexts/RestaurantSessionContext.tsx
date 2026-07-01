import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * RestaurantSessionContext — fonte única de verdade do estabelecimento ativo.
 *
 * Arquitetura multiempresa: cada cliente entra pela URL pública de UM
 * estabelecimento (/{slug}) e todo o resto da sessão (login, cadastro,
 * refresh, navegação) mantém esse contexto.
 *
 * Persistência: guardamos o snapshot identificado pelo restaurant_id.
 * Na restauração (refresh / login / troca de sessão) SEMPRE revalidamos
 * contra o banco pelo ID — nunca confiamos em slug salvo. Assim:
 *  - se o restaurante foi renomeado, o slug novo é obtido do banco;
 *  - se foi removido/desativado, marcamos "unavailable" (sem redirecionar
 *    para outro estabelecimento).
 */

const SESSION_KEY = "localix:restaurant-session";

export type RestaurantSession = {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantLogo: string | null;
};

export type RestaurantSessionStatus =
  | "restoring"    // validando snapshot persistido contra o banco
  | "ready"        // restaurante ativo confirmado no banco
  | "unavailable"  // restaurante salvo não existe mais no banco
  | "empty";       // nenhum restaurante visitado nesta sessão

type RestaurantSessionContextValue = {
  session: RestaurantSession | null;
  status: RestaurantSessionStatus;
  /** Chamado quando uma página pública de restaurante carrega com sucesso. */
  setActiveRestaurant: (details: RestaurantSession) => void;
  /** Marca o restaurante da sessão como indisponível (removido do banco). */
  markUnavailable: () => void;
};

const RestaurantSessionContext = createContext<RestaurantSessionContextValue | null>(null);

function isBrowser() {
  return typeof window !== "undefined";
}

function readSnapshot(): RestaurantSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RestaurantSession>;
    if (!parsed.restaurantId || !parsed.restaurantSlug) return null;
    return {
      restaurantId: parsed.restaurantId,
      restaurantSlug: parsed.restaurantSlug,
      restaurantName: parsed.restaurantName ?? "",
      restaurantLogo: parsed.restaurantLogo ?? null,
    };
  } catch {
    return null;
  }
}

function persistSnapshot(session: RestaurantSession | null) {
  if (!isBrowser()) return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function RestaurantSessionProvider({ children }: { children: ReactNode }) {
  // Começa vazio no SSR e na hidratação (o servidor não tem localStorage);
  // o snapshot é restaurado num useEffect pós-hidratação para evitar
  // divergência entre HTML do servidor e do cliente.
  const [session, setSession] = useState<RestaurantSession | null>(null);
  const [status, setStatus] = useState<RestaurantSessionStatus>("empty");
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const setActiveRestaurant = useCallback((details: RestaurantSession) => {
    setSession(details);
    setStatus("ready");
    persistSnapshot(details);
  }, []);

  const markUnavailable = useCallback(() => {
    setStatus((prev) => (sessionRef.current ? "unavailable" : prev));
  }, []);

  /** Revalida o snapshot persistido pelo restaurant_id (nunca pelo slug). */
  const revalidate = useCallback(async () => {
    const snapshot = sessionRef.current;
    if (!snapshot) return;
    try {
      const { data, error } = await (supabase as any)
        .from("restaurants_public")
        .select("id, slug, name, logo_url")
        .eq("id", snapshot.restaurantId)
        .maybeSingle();
      if (error) {
        // Erro de rede/consulta: mantém o snapshot atual sem invalidar.
        setStatus("ready");
        return;
      }
      if (!data) {
        setStatus("unavailable");
        return;
      }
      const fresh: RestaurantSession = {
        restaurantId: data.id,
        restaurantSlug: data.slug,
        restaurantName: data.name ?? snapshot.restaurantName,
        restaurantLogo: data.logo_url ?? null,
      };
      setSession(fresh);
      setStatus("ready");
      persistSnapshot(fresh);
    } catch {
      setStatus("ready");
    }
  }, []);

  // Restaura + valida no primeiro mount do cliente (refresh da página).
  useEffect(() => {
    const snapshot = readSnapshot();
    // eslint-disable-next-line no-console
    console.debug("[RSC] restore effect, snapshot:", snapshot);
    if (!snapshot) return;
    setSession(snapshot);
    setStatus("restoring");
    sessionRef.current = snapshot;
    void revalidate();
  }, [revalidate]);

  // Login, cadastro ou atualização de sessão: NUNCA limpa o contexto —
  // apenas revalida os dados do restaurante pelo ID.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void revalidate();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [revalidate]);

  const value = useMemo<RestaurantSessionContextValue>(
    () => ({ session, status, setActiveRestaurant, markUnavailable }),
    [session, status, setActiveRestaurant, markUnavailable],
  );

  return <RestaurantSessionContext.Provider value={value}>{children}</RestaurantSessionContext.Provider>;
}

export function useRestaurantSession() {
  const ctx = useContext(RestaurantSessionContext);
  if (!ctx) throw new Error("useRestaurantSession must be used inside RestaurantSessionProvider");
  return ctx;
}
