import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type FeaturedItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  is_available: boolean;
};

export type FeaturedSectionKey =
  | "promotions"
  | "weekly_favorites"
  | "top_rated"
  | "new_items"
  | "customer_favorites"
  | "half_half_pizza";

export type FeaturedSection = {
  key: FeaturedSectionKey;
  title: string;
  subtitle: string;
  emoji: string;
  items: FeaturedItem[];
  builderId?: string;
};

export type FeaturedDiagnostic = {
  key: FeaturedSectionKey;
  label: string;
  emoji: string;
  enabled: boolean;
  count: number;
  rendered: boolean;
  note: string;
};

export type FeaturedConfig = {
  promotions_enabled: boolean;
  weekly_favorites_enabled: boolean;
  top_rated_enabled: boolean;
  new_items_enabled: boolean;
  customer_favorites_enabled: boolean;
  half_half_pizza_enabled: boolean;
};

const DEFAULT_CONFIG: FeaturedConfig = {
  promotions_enabled: true,
  weekly_favorites_enabled: true,
  top_rated_enabled: true,
  new_items_enabled: true,
  customer_favorites_enabled: true,
  half_half_pizza_enabled: false,
};

const NEW_DAYS = 30;

function toItem(row: any): FeaturedItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    price: Number(row.price),
    promo_price: row.promo_price == null ? null : Number(row.promo_price),
    image_url: row.image_url ?? null,
    is_available: row.is_available !== false,
  };
}

export const getFeaturedSections = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("id, category")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (!rest) return { config: DEFAULT_CONFIG, sections: [] as FeaturedSection[] };

    const restaurantId = rest.id as string;
    const isPizzeria = /pizz/i.test(String(rest.category ?? ""));

    const [{ data: cfgRow }, { data: allItems }, { data: builders }, { data: favRows }, { data: reviewRows }] = await Promise.all([
      supabaseAdmin.from("featured_sections").select("*").eq("restaurant_id", restaurantId).maybeSingle(),
      supabaseAdmin
        .from("menu_items")
        .select("id, name, description, price, promo_price, image_url, is_available, is_active, is_weekly_favorite, promo_starts_at, promo_ends_at, is_paused, created_at, position")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .eq("is_available", true),
      supabaseAdmin
        .from("builders")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true),
      supabaseAdmin
        .from("customer_favorites")
        .select("item_id, item_kind")
        .eq("restaurant_id", restaurantId)
        .eq("item_kind", "menu_item"),
      supabaseAdmin
        .from("reviews")
        .select("rating, orders!inner(id, restaurant_id, items)")
        .eq("restaurant_id", restaurantId),
    ]);

    const config: FeaturedConfig = {
      ...DEFAULT_CONFIG,
      ...(cfgRow ?? {}),
    };

    const items = (allItems ?? []) as any[];
    const itemMap = new Map<string, any>(items.map((i) => [i.id, i]));
    const sections: FeaturedSection[] = [];
    const diagnostics: FeaturedDiagnostic[] = [];

    const pushDiag = (
      key: FeaturedSectionKey,
      label: string,
      emoji: string,
      count: number,
      rendered: boolean,
      note: string,
    ) => {
      diagnostics.push({ key, label, emoji, enabled: !!(config as any)[`${key}_enabled`], count, rendered, note });
    };

    // Promotions — active promo price
    {
      const now = Date.now();
      const promoted = items
        .filter((i) => {
          if (i.is_paused) return false;
          const price = Number(i.price);
          const promo = i.promo_price == null ? null : Number(i.promo_price);
          if (!promo || promo <= 0 || promo >= price) return false;
          if (i.promo_starts_at && now < new Date(i.promo_starts_at).getTime()) return false;
          if (i.promo_ends_at && now > new Date(i.promo_ends_at).getTime()) return false;
          return true;
        })
        .map((i) => ({ item: i, discount: 1 - Number(i.promo_price) / Number(i.price) }))
        .sort((a, b) => b.discount - a.discount)
        .slice(0, 20)
        .map(({ item }) => toItem(item));
      const rendered = config.promotions_enabled && promoted.length > 0;
      if (rendered) {
        sections.push({ key: "promotions", title: "Promoções", subtitle: "Ofertas ativas agora", emoji: "⭐", items: promoted });
      }
      pushDiag("promotions", "Promoções", "⭐", promoted.length, rendered,
        !config.promotions_enabled ? "Desativada" : promoted.length === 0 ? "Nenhuma promoção ativa" : "OK");
    }

    // Weekly favorites — marked manually
    {
      const weekly = items
        .filter((i) => i.is_weekly_favorite)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .slice(0, 10)
        .map(toItem);
      const rendered = config.weekly_favorites_enabled && weekly.length > 0;
      if (rendered) {
        sections.push({ key: "weekly_favorites", title: "Queridinhos da Semana", subtitle: "Selecionados pelo restaurante", emoji: "❤️", items: weekly });
      }
      pushDiag("weekly_favorites", "Queridinhos da Semana", "🔥", weekly.length, rendered,
        !config.weekly_favorites_enabled ? "Desativada" : weekly.length === 0 ? "Marque produtos como Queridinho" : "OK");
    }

    // Top rated — aggregate from order-level reviews
    {
      const stats = new Map<string, { sum: number; count: number }>();
      for (const r of (reviewRows ?? []) as any[]) {
        const orderItems = ((r as any).orders?.items ?? []) as any[];
        if (!Array.isArray(orderItems)) continue;
        for (const oi of orderItems) {
          const id = String(oi?.id ?? "");
          if (!id || !itemMap.has(id)) continue;
          const s = stats.get(id) ?? { sum: 0, count: 0 };
          s.sum += Number(r.rating) || 0;
          s.count += 1;
          stats.set(id, s);
        }
      }
      const ranked = Array.from(stats.entries())
        .filter(([, s]) => s.count >= 5)
        .map(([id, s]) => ({ id, avg: s.sum / s.count, count: s.count }))
        .sort((a, b) => b.avg - a.avg || b.count - a.count)
        .slice(0, 15)
        .map(({ id }) => toItem(itemMap.get(id)));
      const rendered = config.top_rated_enabled && ranked.length > 0;
      if (rendered) {
        sections.push({ key: "top_rated", title: "Mais Bem Avaliados", subtitle: "Aprovados pelos clientes", emoji: "🏆", items: ranked });
      }
      pushDiag("top_rated", "Mais Bem Avaliados", "🏆", ranked.length, rendered,
        !config.top_rated_enabled ? "Desativada" : ranked.length === 0 ? "Nenhum produto com 5+ avaliações" : "OK");
    }

    // New items — last 30 days
    {
      const cutoff = Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000;
      const news = items
        .filter((i) => new Date(i.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15)
        .map(toItem);
      const rendered = config.new_items_enabled && news.length > 0;
      if (rendered) {
        sections.push({ key: "new_items", title: "Novidades", subtitle: `Adicionados nos últimos ${NEW_DAYS} dias`, emoji: "🆕", items: news });
      }
      pushDiag("new_items", "Novidades", "🆕", news.length, rendered,
        !config.new_items_enabled ? "Desativada" : news.length === 0 ? "Nenhum produto nos últimos 30 dias" : "OK");
    }

    // Customer favorites — most saved
    {
      const counts = new Map<string, number>();
      for (const f of (favRows ?? []) as any[]) {
        counts.set(f.item_id, (counts.get(f.item_id) ?? 0) + 1);
      }
      const favs = Array.from(counts.entries())
        .filter(([id]) => itemMap.has(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([id]) => toItem(itemMap.get(id)));
      const rendered = config.customer_favorites_enabled && favs.length > 0;
      if (rendered) {
        sections.push({ key: "customer_favorites", title: "Favoritos dos Clientes", subtitle: "Os mais salvos", emoji: "😍", items: favs });
      }
      pushDiag("customer_favorites", "Favoritos dos Clientes", "😍", favs.length, rendered,
        !config.customer_favorites_enabled ? "Desativada" : favs.length === 0 ? "Ninguém favoritou ainda" : "OK");
    }

    // Half-half pizza — needs matching builder (pizzeria hint no longer blocks)
    {
      const allBuilders = (builders ?? []) as any[];
      const builder =
        allBuilders.find((b) => /meio\s*(a|\/)?\s*meio|meio-a-meio|1\/2/i.test(String(b.name ?? ""))) ??
        (isPizzeria ? allBuilders[0] : undefined);
      const rendered = config.half_half_pizza_enabled && !!builder;
      if (rendered && builder) {
        sections.push({
          key: "half_half_pizza",
          title: "Monte sua Pizza Meio a Meio",
          subtitle: "Combine dois sabores",
          emoji: "🍕",
          items: [],
          builderId: builder.id,
        });
      }
      pushDiag("half_half_pizza", "Pizza Meio a Meio", "🍕", builder ? 1 : 0, rendered,
        !config.half_half_pizza_enabled ? "Desativada" : !builder ? "Builder inexistente" : "Builder encontrado");
    }

    return { config, sections, diagnostics };
  });
