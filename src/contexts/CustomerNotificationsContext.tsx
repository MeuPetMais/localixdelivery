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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import {
  ensureNotificationPermission,
  installAudioUnlock,
  playNotificationSound,
  showBackgroundNotification,
  vibrateNotification,
} from "@/lib/customer-notify";

export type CustomerNotification = {
  id: string;
  customer_id: string;
  order_id: string | null;
  restaurant_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
};

type Ctx = {
  notifications: CustomerNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  loading: boolean;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function CustomerNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useCustomerAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  // Instala unlock de áudio no primeiro gesto (uma vez).
  useEffect(() => {
    installAudioUnlock();
  }, []);

  // Solicita permissão de notificação após login (best-effort).
  useEffect(() => {
    if (!isAuthenticated) return;
    ensureNotificationPermission().then((p) => {
      console.log("[notify] permissão atual:", p);
    });
  }, [isAuthenticated]);

  // Snapshot inicial.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      seenIds.current.clear();
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("customer_notifications")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) console.warn("[notify] snapshot erro:", error);
      if (!active) return;
      const rows = (data ?? []) as CustomerNotification[];
      rows.forEach((n) => seenIds.current.add(n.id));
      setNotifications(rows);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // Realtime.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`customer-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_notifications",
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as CustomerNotification;
          console.log("[notify] Realtime recebido:", n.type, n.title);
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          setNotifications((prev) => [n, ...prev]);

          // Som + vibração sempre (respeitando prefs internos).
          playNotificationSound();
          vibrateNotification([250, 100, 250]);

          if (document.visibilityState === "visible") {
            toast(n.title, {
              description: n.body ?? undefined,
              duration: 6000,
              action: n.order_id
                ? {
                    label: "Acompanhar pedido",
                    onClick: () => {
                      window.location.assign(`/pedido/${n.order_id}`);
                    },
                  }
                : undefined,
            });
          } else {
            showBackgroundNotification({
              title: n.title,
              body: n.body,
              tag: n.id,
              url: n.order_id ? `/pedido/${n.order_id}` : "/",
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customer_notifications",
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as CustomerNotification;
          setNotifications((prev) => prev.map((p) => (p.id === n.id ? n : p)));
        },
      )
      .subscribe((status) => {
        console.log("[notify] Realtime canal:", status);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    await supabase
      .from("customer_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from("customer_notifications")
      .update({ read_at: now })
      .eq("customer_id", user.id)
      .is("read_at", null);
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const value = useMemo<Ctx>(
    () => ({ notifications, unreadCount, markRead, markAllRead, loading }),
    [notifications, unreadCount, markRead, markAllRead, loading],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useCustomerNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      markRead: async () => {},
      markAllRead: async () => {},
      loading: false,
    };
  }
  return ctx;
}
