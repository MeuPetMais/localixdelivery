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

function playPing() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, now);
    o.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.45);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {}
}

function vibrate() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch {}
}

function showBrowserNotification(n: CustomerNotification) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // toast já é exibido
    new Notification(n.title, { body: n.body ?? undefined, tag: n.id });
  } catch {}
}

export function CustomerNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useCustomerAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  // Solicita permissão de notificação uma vez após login.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Best-effort — alguns navegadores exigem gesto do usuário.
      Notification.requestPermission().catch(() => {});
    }
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
      const { data } = await supabase
        .from("customer_notifications")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
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
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          setNotifications((prev) => [n, ...prev]);
          playPing();
          vibrate();
          showBrowserNotification(n);
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
      .subscribe();
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
