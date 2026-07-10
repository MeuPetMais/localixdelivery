// useCustomerTracking — Hook: fetch + realtime + freshness ticker.
// Consome customer-tracking function pública e canal tracking-public-{orderId}.

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerTracking } from "./customer-tracking.functions";
import { subscribePublicOrderTracking } from "../tracking.realtime";
import type { CustomerTrackingView } from "./customer-tracking.types";

export interface UseCustomerTrackingResult {
  view: CustomerTrackingView | null;
  loading: boolean;
  offline: boolean;
  refresh: () => void;
  nowMs: number;
}

export function useCustomerTracking(orderId: string | null | undefined): UseCustomerTrackingResult {
  const fetchFn = useServerFn(getCustomerTracking);
  const [view, setView] = useState<CustomerTrackingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const v = await fetchFn({ data: { orderId } });
      if (!mountedRef.current) return;
      setView(v);
      setOffline(false);
    } catch {
      if (!mountedRef.current) return;
      setOffline(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [orderId, fetchFn]);

  useEffect(() => {
    mountedRef.current = true;
    if (!orderId) { setLoading(false); return; }
    void load();
    const poll = setInterval(load, 20000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const unsub = subscribePublicOrderTracking(orderId, {
      onUpdate: () => void load(),
      onError: () => setOffline(true),
    });
    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      unsub();
    };
  }, [orderId, load]);

  // Freshness ticker (10s) para relabel "há X segundos".
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  return { view, loading, offline, refresh: load, nowMs };
}
