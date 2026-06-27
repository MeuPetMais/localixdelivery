import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for customer authentication.
 *
 * - Restores the session from storage on mount (INITIAL_SESSION).
 * - Listens to onAuthStateChange for subsequent events.
 * - `loading` stays true until the session has been restored.
 * - Never redirects: screens decide what to render based on the state.
 */
export function useCustomerAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    // Listener FIRST so we don't miss the INITIAL_SESSION event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setIsReady(true);
    });

    // Then explicitly hydrate from storage in case the listener hasn't fired yet.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return {
    user,
    session,
    loading: !isReady,
    isAuthenticated: !!user,
  };
}
