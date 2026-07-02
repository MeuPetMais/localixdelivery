export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      builder_groups: {
        Row: {
          builder_id: string
          created_at: string
          id: string
          is_required: boolean
          max_select: number
          min_select: number
          name: string
          position: number
        }
        Insert: {
          builder_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name: string
          position?: number
        }
        Update: {
          builder_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "builder_groups_builder_id_fkey"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "builders"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          max_qty: number
          name: string
          position: number
          price_delta: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          max_qty?: number
          name: string
          position?: number
          price_delta?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          max_qty?: number
          name?: string
          position?: number
          price_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "builder_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "builder_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      builders: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          position: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          position?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          position?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_percent: number
          id: string
          is_active: boolean
          restaurant_id: string
          updated_at: string
          uses_count: number
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_percent: number
          id?: string
          is_active?: boolean
          restaurant_id: string
          updated_at?: string
          uses_count?: number
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          restaurant_id?: string
          updated_at?: string
          uses_count?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          cep: string | null
          city: string | null
          complement: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string
          neighborhood: string
          notes: string | null
          number: string | null
          state: string | null
          street: string
          updated_at: string
        }
        Insert: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood: string
          notes?: string | null
          number?: string | null
          state?: string | null
          street: string
          updated_at?: string
        }
        Update: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string
          notes?: string | null
          number?: string | null
          state?: string | null
          street?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_favorites: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          item_id: string
          item_kind: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          item_id: string
          item_kind: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          item_id?: string
          item_kind?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notifications: {
        Row: {
          body: string | null
          created_at: string
          customer_id: string
          data: Json
          id: string
          order_id: string | null
          read_at: string | null
          restaurant_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_id: string
          data?: Json
          id?: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_id?: string
          data?: Json
          id?: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_points: {
        Row: {
          balance: number
          created_at: string
          customer_id: string
          id: string
          total_earned: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          customer_id: string
          id?: string
          total_earned?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          customer_id?: string
          id?: string
          total_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_points_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_payment_method: string | null
          phone: string | null
          provider: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_payment_method?: string | null
          phone?: string | null
          provider?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_payment_method?: string | null
          phone?: string | null
          provider?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          avg_ticket: number
          created_at: string
          email: string | null
          id: string
          last_order_at: string | null
          name: string
          phone: string
          restaurant_id: string
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          avg_ticket?: number
          created_at?: string
          email?: string | null
          id?: string
          last_order_at?: string | null
          name: string
          phone: string
          restaurant_id: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          avg_ticket?: number
          created_at?: string
          email?: string | null
          id?: string
          last_order_at?: string | null
          name?: string
          phone?: string
          restaurant_id?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_sections: {
        Row: {
          customer_favorites_enabled: boolean
          half_half_pizza_enabled: boolean
          new_items_enabled: boolean
          promotions_enabled: boolean
          restaurant_id: string
          top_rated_enabled: boolean
          updated_at: string
          weekly_favorites_enabled: boolean
        }
        Insert: {
          customer_favorites_enabled?: boolean
          half_half_pizza_enabled?: boolean
          new_items_enabled?: boolean
          promotions_enabled?: boolean
          restaurant_id: string
          top_rated_enabled?: boolean
          updated_at?: string
          weekly_favorites_enabled?: boolean
        }
        Update: {
          customer_favorites_enabled?: boolean
          half_half_pizza_enabled?: boolean
          new_items_enabled?: boolean
          promotions_enabled?: boolean
          restaurant_id?: string
          top_rated_enabled?: boolean
          updated_at?: string
          weekly_favorites_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "featured_sections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_sections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          movement_date: string
          restaurant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          movement_date?: string
          restaurant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          movement_date?: string
          restaurant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          created_at: string
          id: string
          min_stock: number
          name: string
          restaurant_id: string
          stock: number
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          restaurant_id: string
          stock?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          restaurant_id?: string
          stock?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_images: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          menu_item_id: string
          position: number
          restaurant_id: string
          storage_path: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          menu_item_id: string
          position?: number
          restaurant_id: string
          storage_path: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          menu_item_id?: string
          position?: number
          restaurant_id?: string
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_images_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_images_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_images_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available_delivery: boolean
          available_pickup: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          is_bestseller: boolean
          is_featured: boolean
          is_paused: boolean
          is_weekly_favorite: boolean
          name: string
          position: number
          prep_time_minutes: number | null
          price: number
          promo_campaign: string | null
          promo_ends_at: string | null
          promo_price: number | null
          promo_starts_at: string | null
          recurrence_days: number[] | null
          recurrence_end_time: string | null
          recurrence_start_time: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          available_delivery?: boolean
          available_pickup?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          is_bestseller?: boolean
          is_featured?: boolean
          is_paused?: boolean
          is_weekly_favorite?: boolean
          name: string
          position?: number
          prep_time_minutes?: number | null
          price: number
          promo_campaign?: string | null
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          recurrence_days?: number[] | null
          recurrence_end_time?: string | null
          recurrence_start_time?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          available_delivery?: boolean
          available_pickup?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          is_bestseller?: boolean
          is_featured?: boolean
          is_paused?: boolean
          is_weekly_favorite?: boolean
          name?: string
          position?: number
          prep_time_minutes?: number | null
          price?: number
          promo_campaign?: string | null
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          recurrence_days?: number[] | null
          recurrence_end_time?: string | null
          recurrence_start_time?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          commission_rate: number | null
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          discount: number
          estimated_delivery_time: number | null
          fixed_fee: number | null
          id: string
          items: Json
          order_number: number | null
          payment_method: string | null
          platform_fee: number | null
          restaurant_id: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          commission_rate?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number
          estimated_delivery_time?: number | null
          fixed_fee?: number | null
          id?: string
          items?: Json
          order_number?: number | null
          payment_method?: string | null
          platform_fee?: number | null
          restaurant_id: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          commission_rate?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          estimated_delivery_time?: number | null
          fixed_fee?: number | null
          id?: string
          items?: Json
          order_number?: number | null
          payment_method?: string | null
          platform_fee?: number | null
          restaurant_id?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email_notifications: boolean
          full_name: string | null
          id: string
          language: string
          marketing_optin: boolean
          phone: string | null
          push_notifications: boolean
          role_title: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email_notifications?: boolean
          full_name?: string | null
          id: string
          language?: string
          marketing_optin?: boolean
          phone?: string | null
          push_notifications?: boolean
          role_title?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email_notifications?: boolean
          full_name?: string | null
          id?: string
          language?: string
          marketing_optin?: boolean
          phone?: string | null
          push_notifications?: boolean
          role_title?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          banner_url: string | null
          city_fees: Json
          commission_rate: number
          contact_email: string | null
          contact_whatsapp: string | null
          delivery_fee_default: number
          domain: string | null
          fixed_fee: number
          id: boolean
          logo_url: string | null
          min_order: number
          name: string
          primary_color: string | null
          tier_fees: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banner_url?: string | null
          city_fees?: Json
          commission_rate?: number
          contact_email?: string | null
          contact_whatsapp?: string | null
          delivery_fee_default?: number
          domain?: string | null
          fixed_fee?: number
          id?: boolean
          logo_url?: string | null
          min_order?: number
          name?: string
          primary_color?: string | null
          tier_fees?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banner_url?: string | null
          city_fees?: Json
          commission_rate?: number
          contact_email?: string | null
          contact_whatsapp?: string | null
          delivery_fee_default?: number
          domain?: string | null
          fixed_fee?: number
          id?: boolean
          logo_url?: string | null
          min_order?: number
          name?: string
          primary_color?: string | null
          tier_fees?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          product_name: string
          quantity: number
          reference_price: number | null
          supplier_id: string
          total: number
          unit: string
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          quantity: number
          reference_price?: number | null
          supplier_id: string
          total: number
          unit?: string
          unit_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          quantity?: number
          reference_price?: number | null
          supplier_id?: string
          total?: number
          unit?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          restaurant_id: string | null
          role: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          restaurant_id?: string | null
          role?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          restaurant_id?: string | null
          role?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          product_name: string
          quantity: number
          status: string
          supplier_id: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          product_name: string
          quantity: number
          status?: string
          supplier_id: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          product_name?: string
          quantity?: number
          status?: string
          supplier_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          menu_item_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          menu_item_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          menu_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          active: boolean
          address: string | null
          address_number: string | null
          avg_delivery_minutes: number | null
          avg_pickup_minutes: number | null
          builders_enabled: boolean
          category: string | null
          city: string | null
          cnpj: string | null
          complement: string | null
          cover_url: string | null
          created_at: string
          delivery_fee: number
          delivery_radius: number | null
          delivery_time: string | null
          description: string | null
          email: string | null
          facebook: string | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          is_open: boolean
          landline_phone: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          manager_name: string | null
          min_order: number
          name: string
          neighborhood: string | null
          opening_hours: Json | null
          owner_id: string
          owner_name: string | null
          payment_methods: Json | null
          phone: string | null
          primary_color: string | null
          slug: string
          state: string | null
          updated_at: string
          website: string | null
          whatsapp_phone: string
          zip_code: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          avg_delivery_minutes?: number | null
          avg_pickup_minutes?: number | null
          builders_enabled?: boolean
          category?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_radius?: number | null
          delivery_time?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_open?: boolean
          landline_phone?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          manager_name?: string | null
          min_order?: number
          name: string
          neighborhood?: string | null
          opening_hours?: Json | null
          owner_id: string
          owner_name?: string | null
          payment_methods?: Json | null
          phone?: string | null
          primary_color?: string | null
          slug: string
          state?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_phone: string
          zip_code?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          address_number?: string | null
          avg_delivery_minutes?: number | null
          avg_pickup_minutes?: number | null
          builders_enabled?: boolean
          category?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_radius?: number | null
          delivery_time?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_open?: boolean
          landline_phone?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          manager_name?: string | null
          min_order?: number
          name?: string
          neighborhood?: string | null
          opening_hours?: Json | null
          owner_id?: string
          owner_name?: string | null
          payment_methods?: Json | null
          phone?: string | null
          primary_color?: string | null
          slug?: string
          state?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_phone?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          order_id: string
          owner_reply: string | null
          owner_reply_at: string | null
          rating: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_id: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          rating: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_id?: string
          owner_reply?: string | null
          owner_reply_at?: string | null
          rating?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_favorites: {
        Row: {
          created_at: string
          id: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supplier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_favorites_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          category: string
          created_at: string
          id: string
          image_url: string | null
          name: string
          price: number
          supplier_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          price: number
          supplier_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          supplier_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          category: string
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_articles: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          position: number
          published: boolean
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachments: Json
          author_id: string
          author_type: string
          body: string | null
          created_at: string
          id: string
          read_by_admin: boolean
          read_by_owner: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          author_type?: string
          body?: string | null
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_owner?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          author_type?: string
          body?: string | null
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_owner?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["support_category"]
          created_at: string
          description: string
          diagnostics: Json
          id: string
          last_message_at: string
          priority: Database["public"]["Enums"]["support_priority"]
          restaurant_id: string
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          ticket_number: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          created_at?: string
          description: string
          diagnostics?: Json
          id?: string
          last_message_at?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          restaurant_id: string
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          ticket_number?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          created_at?: string
          description?: string
          diagnostics?: Json
          id?: string
          last_message_at?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          restaurant_id?: string
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          ticket_number?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      restaurants_public: {
        Row: {
          address: string | null
          address_number: string | null
          avg_delivery_minutes: number | null
          avg_pickup_minutes: number | null
          builders_enabled: boolean | null
          category: string | null
          city: string | null
          complement: string | null
          cover_url: string | null
          created_at: string | null
          delivery_fee: number | null
          delivery_radius: number | null
          delivery_time: string | null
          description: string | null
          email: string | null
          facebook: string | null
          google_maps_url: string | null
          id: string | null
          instagram: string | null
          is_open: boolean | null
          landline_phone: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          min_order: number | null
          name: string | null
          neighborhood: string | null
          opening_hours: Json | null
          payment_methods: Json | null
          primary_color: string | null
          slug: string | null
          state: string | null
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          avg_delivery_minutes?: number | null
          avg_pickup_minutes?: number | null
          builders_enabled?: boolean | null
          category?: string | null
          city?: string | null
          complement?: string | null
          cover_url?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          delivery_radius?: number | null
          delivery_time?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string | null
          instagram?: string | null
          is_open?: boolean | null
          landline_phone?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          min_order?: number | null
          name?: string | null
          neighborhood?: string | null
          opening_hours?: Json | null
          payment_methods?: Json | null
          primary_color?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          avg_delivery_minutes?: number | null
          avg_pickup_minutes?: number | null
          builders_enabled?: boolean | null
          category?: string | null
          city?: string | null
          complement?: string | null
          cover_url?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          delivery_radius?: number | null
          delivery_time?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          id?: string | null
          instagram?: string | null
          is_open?: boolean | null
          landline_phone?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          min_order?: number | null
          name?: string | null
          neighborhood?: string | null
          opening_hours?: Json | null
          payment_methods?: Json | null
          primary_color?: string | null
          slug?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reset_demo_environment: { Args: never; Returns: Json }
      seed_demo_marketplace: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "partner"
        | "customer"
        | "financeiro"
        | "comercial"
        | "atendimento"
        | "marketing"
        | "analista"
      support_category:
        | "problema_tecnico"
        | "pedido"
        | "pagamentos"
        | "cardapio"
        | "builder"
        | "impressao"
        | "financeiro"
        | "fidelidade"
        | "ia"
        | "sugestao"
        | "outro"
      support_priority: "baixa" | "media" | "alta" | "urgente"
      support_status:
        | "aberto"
        | "em_analise"
        | "respondido"
        | "resolvido"
        | "fechado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "partner",
        "customer",
        "financeiro",
        "comercial",
        "atendimento",
        "marketing",
        "analista",
      ],
      support_category: [
        "problema_tecnico",
        "pedido",
        "pagamentos",
        "cardapio",
        "builder",
        "impressao",
        "financeiro",
        "fidelidade",
        "ia",
        "sugestao",
        "outro",
      ],
      support_priority: ["baixa", "media", "alta", "urgente"],
      support_status: [
        "aberto",
        "em_analise",
        "respondido",
        "resolvido",
        "fechado",
      ],
    },
  },
} as const
