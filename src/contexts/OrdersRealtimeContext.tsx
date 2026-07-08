import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { playOrderSound, vibratePattern, type OrderSoundKey } from "@/lib/order-sounds";
import { printAutoCopies, isAutoPrintEnabled, type PrintableOrder } from "@/lib/print-service";
import { transitionOrderStatus } from "@/lib/orders/orders.functions";
import {
  announceNewOrder,
  announcePendingCount,
  announceLongWaiting,
} from "@/lib/voice-announcer";

/**
 * OrdersRealtimeProvider
 *
 * Uma única assinatura Realtime por restaurante para:
 *  - contar pedidos "novos" (badge do menu Pedidos + título da aba)
 *  - notificar (toast + som) apenas UMA vez por pedido (dedupe por id)
 *  - expor o último pedido novo para o card destacado do Dashboard
 *  - invalidar as queries de dashboard/pedidos para atualização em tempo real
 */

type PendingOrder = {
  id: string;
  order_number: number | null;
  customer_name: string;
  total: number;
  payment_method: string | null;
  status: string;
  created_at: string;
};

type Ctx = {
  unseenCount: number;
  latestNew: PendingOrder | null;
  acceptLatest: () => Promise<void>;
  dismissLatest: () => void;
  markViewed: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
};

const OrdersRealtimeContext = createContext<Ctx | null>(null);

const PENDING_STATUSES = new Set(["novo", "aguardando_confirmacao"]);

const STATUS_TO_SOUND: Record<string, OrderSoundKey> = {
  novo: "new",
  aguardando_confirmacao: "new",
  em_preparo: "preparing",
  pronto: "out_for_delivery",
  saiu_para_entrega: "out_for_delivery",
  entregue: "delivered",
  cancelado: "canceled",
};

function playChime() {
  playOrderSound("new");
}

function playCancelChime() {
  playOrderSound("canceled");
}


export function OrdersRealtimeProvider({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [unseen, setUnseen] = useState<PendingOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const notifiedIds = useRef<Set<string>>(new Set());
  const baseTitleRef = useRef<string>("");

  const markViewed = useCallback(() => setUnseen([]), []);
  const dismissLatest = useCallback(
    () => setUnseen((prev) => prev.slice(0, -1)),
    [],
  );

  const acceptLatest = useCallback(async () => {
    const latest = unseen[unseen.length - 1];
    if (!latest) return;
    setUnseen((prev) => prev.filter((o) => o.id !== latest.id));
    const { error } = await supabase
      .from("orders")
      .update({ status: "em_preparo" })
      .eq("id", latest.id);
    if (error) toast.error("Não foi possível aceitar o pedido");
    else toast.success(`Pedido #${latest.order_number ?? ""} aceito`);
  }, [unseen]);

  // Carrega snapshot inicial de pedidos pendentes.
  useEffect(() => {
    if (!restaurantId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, total, payment_method, status, created_at")
        .eq("restaurant_id", restaurantId)
        .in("status", ["novo", "aguardando_confirmacao"])
        .order("created_at", { ascending: true });
      if (!active) return;
      const rows = ((data ?? []) as PendingOrder[]).map((o) => ({
        ...o,
        total: Number(o.total),
      }));
      rows.forEach((o) => notifiedIds.current.add(o.id));
      setUnseen(rows);
    })();
    return () => {
      active = false;
    };
  }, [restaurantId]);

  // Assinatura Realtime única por restaurante.
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`orders-notify-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const evt = payload.eventType;
          const row = (payload.new ?? payload.old) as PendingOrder | undefined;
          if (!row) return;

          // Dashboard depende de agregados — invalida.
          qc.invalidateQueries({ queryKey: ["dashboard", restaurantId] });

          // Kanban: patch cirúrgico no cache, sem refetch da lista inteira.
          const ordersKey = ["orders", restaurantId] as const;
          qc.setQueriesData<any[]>({ queryKey: ordersKey }, (prev) => {
            const list = Array.isArray(prev) ? prev : [];
            if (evt === "INSERT") {
              if (list.some((o) => o.id === row.id)) return list;
              return [{ ...row, total: Number(row.total) }, ...list];
            }
            if (evt === "UPDATE") {
              return list.map((o) => (o.id === row.id ? { ...o, ...row, total: Number(row.total) } : o));
            }
            if (evt === "DELETE") {
              return list.filter((o) => o.id !== row.id);
            }
            return list;
          });

          if (evt === "INSERT") {
            const isPending = PENDING_STATUSES.has(row.status);
            if (!isPending) return;
            if (notifiedIds.current.has(row.id)) return; // dedupe
            notifiedIds.current.add(row.id);
            const normalized: PendingOrder = { ...row, total: Number(row.total) };
            setUnseen((prev) => [...prev, normalized]);
            if (soundEnabled) playChime();
            vibratePattern([200, 80, 200]);
            announceNewOrder();

            // Auto-print (opt-in): busca linha completa e envia ao adapter.
            if (isAutoPrintEnabled()) {
              supabase
                .from("orders")
                .select("order_number, customer_name, customer_phone, address, items, payment_method, total, created_at, restaurants(name)")
                .eq("id", row.id)
                .maybeSingle()
                .then(({ data }) => {
                  if (!data) return;
                  const printable: PrintableOrder = {
                    order_number: data.order_number,
                    customer_name: data.customer_name,
                    customer_phone: data.customer_phone,
                    address: data.address,
                    items: (data.items as any) ?? [],
                    payment_method: data.payment_method,
                    total: Number(data.total),
                    created_at: data.created_at,
                    restaurant_name: (data.restaurants as any)?.name ?? null,
                  };
                  printAutoCopies(printable).catch(() => {});
                });
            }

            toast(
              `🔔 Novo pedido #${row.order_number ?? ""}`,
              {
                description: `${row.customer_name} · ${brl(Number(row.total))}${row.payment_method ? ` · ${row.payment_method}` : ""}`,
                duration: 8000,
                action: {
                  label: "Ver pedido",
                  onClick: () => {
                    window.location.assign("/orders");
                  },
                },
              },
            );
          } else if (evt === "UPDATE") {
            const prevRow = payload.old as PendingOrder | undefined;
            const statusChanged = prevRow?.status !== row.status;
            if (statusChanged && soundEnabled) {
              const key = STATUS_TO_SOUND[row.status];
              if (key) playOrderSound(key);
            }
            if (
              row.status === "cancelado" &&
              prevRow?.status !== "cancelado"
            ) {
              vibratePattern([300, 100, 300]);
              toast(`❌ Pedido #${row.order_number ?? ""} cancelado`, {
                description: row.customer_name,
              });
            }
            setUnseen((prev) =>
              PENDING_STATUSES.has(row.status)
                ? prev.map((o) => (o.id === row.id ? { ...o, ...row, total: Number(row.total) } : o))
                : prev.filter((o) => o.id !== row.id),
            );
          } else if (evt === "DELETE") {

            setUnseen((prev) => prev.filter((o) => o.id !== row.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, qc, soundEnabled]);

  // Título da aba: (N) prefixo enquanto houver pendentes não vistos.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!baseTitleRef.current) {
      baseTitleRef.current = document.title.replace(/^\(\d+\)\s*/, "");
    }
    const base = baseTitleRef.current || "Localix";
    document.title = unseen.length > 0 ? `(${unseen.length}) ${base}` : base;
  }, [unseen.length, pathname]);

  // Ao abrir a tela de pedidos, limpa o contador.
  useEffect(() => {
    if (pathname.startsWith("/orders")) markViewed();
  }, [pathname, markViewed]);

  // Alerta repetido enquanto houver pedidos "novos": 30s, 1min, 1min, 1min...
  // Interrompe automaticamente quando `unseen` esvazia (ao aceitar/cancelar).
  useEffect(() => {
    if (unseen.length === 0) return;
    if (!soundEnabled) return;
    let cancelled = false;
    let step = 0;
    const tick = () => {
      if (cancelled) return;
      playChime();
      vibratePattern([200, 80, 200]);
      // Voz: se há vários pedidos, anuncia a fila; caso contrário, o número
      // do pedido mais antigo aguardando.
      if (unseen.length > 1) {
        announcePendingCount(unseen.length);
      } else {
        announceLongWaiting(unseen[0]?.order_number ?? null);
      }
      step += 1;
      const nextMs = step === 0 ? 30_000 : 60_000;
      timer = window.setTimeout(tick, nextMs);
    };
    let timer = window.setTimeout(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [unseen.length, soundEnabled]);

  const value = useMemo<Ctx>(
    () => ({
      unseenCount: unseen.length,
      latestNew: unseen[unseen.length - 1] ?? null,
      acceptLatest,
      dismissLatest,
      markViewed,
      soundEnabled,
      setSoundEnabled,
    }),
    [unseen, acceptLatest, dismissLatest, markViewed, soundEnabled],
  );

  return (
    <OrdersRealtimeContext.Provider value={value}>{children}</OrdersRealtimeContext.Provider>
  );
}

export function useOrdersRealtime(): Ctx {
  const ctx = useContext(OrdersRealtimeContext);
  if (!ctx) {
    // Fora do dashboard autenticado, devolvemos um stub inerte para permitir
    // que componentes compartilhados renderizem sem quebrar.
    return {
      unseenCount: 0,
      latestNew: null,
      acceptLatest: async () => {},
      dismissLatest: () => {},
      markViewed: () => {},
      soundEnabled: false,
      setSoundEnabled: () => {},
    };
  }
  return ctx;
}
