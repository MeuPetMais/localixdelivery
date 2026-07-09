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
      accounts_payable: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          currency: string
          description: string
          due_date: string | null
          id: string
          metadata: Json
          paid_amount: number
          paid_date: string | null
          restaurant_id: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string
          description: string
          due_date?: string | null
          id?: string
          metadata?: Json
          paid_amount?: number
          paid_date?: string | null
          restaurant_id: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string
          description?: string
          due_date?: string | null
          id?: string
          metadata?: Json
          paid_amount?: number
          paid_date?: string | null
          restaurant_id?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          created_at: string
          currency: string
          expected_date: string | null
          gateway: string | null
          gross_amount: number
          id: string
          metadata: Json
          net_amount: number
          order_id: string | null
          payment_id: string | null
          received_date: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          expected_date?: string | null
          gateway?: string | null
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          order_id?: string | null
          payment_id?: string | null
          received_date?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          expected_date?: string | null
          gateway?: string | null
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          order_id?: string | null
          payment_id?: string | null
          received_date?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
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
      business_rule_execution_log: {
        Row: {
          created_at: string
          customer_id: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json
          order_id: string | null
          reason: string | null
          restaurant_id: string | null
          result: string
          rule_code: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json
          order_id?: string | null
          reason?: string | null
          restaurant_id?: string | null
          result: string
          rule_code: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json
          order_id?: string | null
          reason?: string | null
          restaurant_id?: string | null
          result?: string
          rule_code?: string
        }
        Relationships: []
      }
      business_rules: {
        Row: {
          category: string
          code: string
          configuration_json: Json
          created_at: string
          enabled: boolean
          id: string
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          configuration_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          configuration_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          menu_id: string | null
          payload: Json
          restaurant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          menu_id?: string | null
          payload?: Json
          restaurant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          menu_id?: string | null
          payload?: Json
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "catalog_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_menu_categories: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          is_visible: boolean
          menu_id: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          menu_id: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_visible?: boolean
          menu_id?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_menu_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "catalog_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_menu_products: {
        Row: {
          channel_override: string | null
          created_at: string
          display_order: number
          id: string
          is_featured: boolean
          is_visible: boolean
          menu_id: string
          product_id: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          channel_override?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          menu_id: string
          product_id: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          channel_override?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          menu_id?: string
          product_id?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_menu_products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "catalog_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_menu_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_menu_products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_menu_products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_menus: {
        Row: {
          available_days: number[] | null
          available_end_time: string | null
          available_start_time: string | null
          channel: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_default: boolean
          name: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          channel?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          name: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          channel?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          name?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_menus_restaurant_id_fkey"
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
      customer_communication_history: {
        Row: {
          channel: string
          created_at: string
          customer_id: string
          event_type: string
          id: string
          metadata_json: Json
          reference_id: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id: string
          event_type: string
          id?: string
          metadata_json?: Json
          reference_id?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string
          event_type?: string
          id?: string
          metadata_json?: Json
          reference_id?: string | null
          status?: string
        }
        Relationships: []
      }
      customer_communication_preferences: {
        Row: {
          created_at: string
          customer_id: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          marketing_enabled: boolean
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          customer_id: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      customer_consents: {
        Row: {
          consent_type: string
          created_at: string
          customer_id: string
          granted: boolean
          id: string
          ip_address: string | null
          metadata: Json
          source: string | null
          user_agent: string | null
        }
        Insert: {
          consent_type: string
          created_at?: string
          customer_id: string
          granted: boolean
          id?: string
          ip_address?: string | null
          metadata?: Json
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_type?: string
          created_at?: string
          customer_id?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          metadata?: Json
          source?: string | null
          user_agent?: string | null
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
      customer_insights: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          generated_at: string
          id: string
          insight_type: string
          metadata: Json
          restaurant_id: string
          severity: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          generated_at?: string
          id?: string
          insight_type: string
          metadata?: Json
          restaurant_id: string
          severity?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          generated_at?: string
          id?: string
          insight_type?: string
          metadata?: Json
          restaurant_id?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      customer_loyalty: {
        Row: {
          cashback_balance: number
          created_at: string
          customer_id: string
          id: string
          level: string
          lifetime_cashback: number
          lifetime_points: number
          points_balance: number
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cashback_balance?: number
          created_at?: string
          customer_id: string
          id?: string
          level?: string
          lifetime_cashback?: number
          lifetime_points?: number
          points_balance?: number
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cashback_balance?: number
          created_at?: string
          customer_id?: string
          id?: string
          level?: string
          lifetime_cashback?: number
          lifetime_points?: number
          points_balance?: number
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_restaurant_id_fkey"
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
      customer_preferences: {
        Row: {
          created_at: string
          customer_id: string
          dietary_restrictions: string[]
          email_opt_in: boolean
          language: string
          marketing_opt_in: boolean
          preferred_category: string | null
          preferred_channel: string | null
          preferred_payment_method: string | null
          push_opt_in: boolean
          updated_at: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          created_at?: string
          customer_id: string
          dietary_restrictions?: string[]
          email_opt_in?: boolean
          language?: string
          marketing_opt_in?: boolean
          preferred_category?: string | null
          preferred_channel?: string | null
          preferred_payment_method?: string | null
          push_opt_in?: boolean
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string
          dietary_restrictions?: string[]
          email_opt_in?: boolean
          language?: string
          marketing_opt_in?: boolean
          preferred_category?: string | null
          preferred_channel?: string | null
          preferred_payment_method?: string | null
          push_opt_in?: boolean
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: []
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
      customer_segments: {
        Row: {
          created_at: string
          customer_id: string
          generated_at: string
          id: string
          metadata: Json
          reason: string | null
          restaurant_id: string
          score: number
          segment: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          generated_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          restaurant_id: string
          score?: number
          segment: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          generated_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          restaurant_id?: string
          score?: number
          segment?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_timeline: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          reference_id: string | null
          reference_type: string | null
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id?: string | null
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
      delivery_driver_audit: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          driver_id: string | null
          id: string
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          driver_id?: string | null
          id?: string
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          driver_id?: string | null
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_audit_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          cpf: string | null
          created_at: string
          document_url: string | null
          email: string | null
          id: string
          last_lat: number | null
          last_lng: number | null
          last_seen_at: string | null
          name: string
          online: boolean
          owner_id: string | null
          phone: string | null
          photo_url: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["delivery_driver_status"]
          updated_at: string
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["delivery_driver_vehicle"]
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          document_url?: string | null
          email?: string | null
          id?: string
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          name: string
          online?: boolean
          owner_id?: string | null
          phone?: string | null
          photo_url?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["delivery_driver_status"]
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["delivery_driver_vehicle"]
        }
        Update: {
          cpf?: string | null
          created_at?: string
          document_url?: string | null
          email?: string | null
          id?: string
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          name?: string
          online?: boolean
          owner_id?: string | null
          phone?: string | null
          photo_url?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["delivery_driver_status"]
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["delivery_driver_vehicle"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          created_at: string
          delivery_mode: string
          driver_id: string | null
          estimated_delivery: string | null
          estimated_pickup: string | null
          finished_at: string | null
          id: string
          metadata: Json
          order_id: string
          provider: string
          restaurant_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_mode?: string
          driver_id?: string | null
          estimated_delivery?: string | null
          estimated_pickup?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          order_id: string
          provider?: string
          restaurant_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_mode?: string
          driver_id?: string | null
          estimated_delivery?: string | null
          estimated_pickup?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          provider?: string
          restaurant_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_timeline: {
        Row: {
          actor: string | null
          created_at: string
          delivery_id: string
          event: string
          from_status: string | null
          id: string
          metadata: Json
          to_status: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          delivery_id: string
          event: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          delivery_id?: string
          event?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_timeline_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          captured_at: string
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          captured_at?: string
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          id: string
          license_plate: string | null
          phone: string | null
          provider: string
          rating: number | null
          status: string
          updated_at: string
          user_id: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          license_plate?: string | null
          phone?: string | null
          provider?: string
          rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          license_plate?: string | null
          phone?: string | null
          provider?: string
          rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
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
      financial_ledger: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_id: string | null
          description: string | null
          id: string
          metadata: Json
          order_id: string | null
          provider: string | null
          reference_id: string | null
          reference_type: string | null
          restaurant_id: string | null
          status: Database["public"]["Enums"]["ledger_status"]
          transaction_type: Database["public"]["Enums"]["ledger_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          provider?: string | null
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
          transaction_type: Database["public"]["Enums"]["ledger_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          order_id?: string | null
          provider?: string | null
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
          transaction_type?: Database["public"]["Enums"]["ledger_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
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
      financial_reports: {
        Row: {
          created_at: string
          error: string | null
          expires_at: string | null
          file_format: string
          file_url: string | null
          filters_json: Json
          generated_at: string | null
          generated_by: string | null
          id: string
          report_type: string
          restaurant_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          expires_at?: string | null
          file_format?: string
          file_url?: string | null
          filters_json?: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          report_type: string
          restaurant_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          expires_at?: string | null
          file_format?: string
          file_url?: string | null
          filters_json?: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          report_type?: string
          restaurant_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_cost_history: {
        Row: {
          average_cost: number | null
          created_at: string
          currency: string
          effective_from: string
          effective_until: string | null
          id: string
          ingredient_id: string
          purchase_order_id: string | null
          restaurant_id: string
          supplier_id: string | null
          unit_cost: number
        }
        Insert: {
          average_cost?: number | null
          created_at?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          ingredient_id: string
          purchase_order_id?: string | null
          restaurant_id: string
          supplier_id?: string | null
          unit_cost: number
        }
        Update: {
          average_cost?: number | null
          created_at?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          ingredient_id?: string
          purchase_order_id?: string | null
          restaurant_id?: string
          supplier_id?: string | null
          unit_cost?: number
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          active: boolean
          barcode: string | null
          created_at: string
          id: string
          min_stock: number
          name: string
          reserved_stock: number
          restaurant_id: string
          sku: string | null
          stock: number
          supplier_id: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          reserved_stock?: number
          restaurant_id: string
          sku?: string | null
          stock?: number
          supplier_id?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          reserved_stock?: number
          restaurant_id?: string
          sku?: string | null
          stock?: number
          supplier_id?: string | null
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
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          created_at: string
          default_location: boolean
          description: string | null
          id: string
          name: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          default_location?: boolean
          description?: string | null
          id?: string
          name: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          default_location?: boolean
          description?: string | null
          id?: string
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_locations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_events: {
        Row: {
          created_at: string
          customer_id: string
          dedupe_key: string
          delivered_at: string | null
          event_type: string
          id: string
          payload: Json
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          dedupe_key: string
          delivered_at?: string | null
          event_type: string
          id?: string
          payload?: Json
          restaurant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          dedupe_key?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_levels: {
        Row: {
          active: boolean
          benefits: Json
          created_at: string
          display_order: number
          id: string
          minimum_points: number
          name: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: Json
          created_at?: string
          display_order?: number
          id?: string
          minimum_points?: number
          name: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: Json
          created_at?: string
          display_order?: number
          id?: string
          minimum_points?: number
          name?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_levels_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_levels_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rules: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          ends_at: string | null
          id: string
          max_order: number | null
          min_order: number | null
          name: string
          priority: number
          restaurant_id: string
          rule_type: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          ends_at?: string | null
          id?: string
          max_order?: number | null
          min_order?: number | null
          name: string
          priority?: number
          restaurant_id: string
          rule_type: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          ends_at?: string | null
          id?: string
          max_order?: number | null
          min_order?: number | null
          name?: string
          priority?: number
          restaurant_id?: string
          rule_type?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          balance_after: number | null
          balance_before: number | null
          cashback: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          metadata: Json
          points: number
          reference_id: string | null
          reference_type: string | null
          restaurant_id: string
          source: string | null
          transaction_type: string
        }
        Insert: {
          balance_after?: number | null
          balance_before?: number | null
          cashback?: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          metadata?: Json
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id: string
          source?: string | null
          transaction_type: string
        }
        Update: {
          balance_after?: number | null
          balance_before?: number | null
          cashback?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          metadata?: Json
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id?: string
          source?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_restaurant_id_fkey"
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
      mercado_pago_accounts: {
        Row: {
          access_token: string | null
          connected: boolean
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          expires_at: string | null
          id: string
          live_mode: boolean
          mp_user_id: string | null
          public_key: string | null
          raw: Json | null
          refresh_token: string | null
          restaurant_id: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          mp_user_id?: string | null
          public_key?: string | null
          raw?: Json | null
          refresh_token?: string | null
          restaurant_id: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected?: boolean
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          expires_at?: string | null
          id?: string
          live_mode?: boolean
          mp_user_id?: string | null
          public_key?: string | null
          raw?: Json | null
          refresh_token?: string | null
          restaurant_id?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercado_pago_accounts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_pago_accounts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          execution_time: number | null
          id: string
          notification_id: string | null
          provider: string
          response: Json | null
          status: Database["public"]["Enums"]["notification_status"]
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_time?: number | null
          id?: string
          notification_id?: string | null
          provider: string
          response?: Json | null
          status: Database["public"]["Enums"]["notification_status"]
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_time?: number | null
          id?: string
          notification_id?: string | null
          provider?: string
          response?: Json | null
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          marketing_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          sms_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          code: string
          created_at: string
          enabled: boolean
          id: string
          language: string
          name: string
          subject: string | null
          title: string | null
          updated_at: string
          variables_json: Json
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          code: string
          created_at?: string
          enabled?: boolean
          id?: string
          language?: string
          name: string
          subject?: string | null
          title?: string | null
          updated_at?: string
          variables_json?: Json
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          language?: string
          name?: string
          subject?: string | null
          title?: string | null
          updated_at?: string
          variables_json?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          origin: string | null
          payload_json: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          recipient_id: string | null
          recipient_type: Database["public"]["Enums"]["notification_recipient_type"]
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template_code: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          origin?: string | null
          payload_json?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_id?: string | null
          recipient_type?: Database["public"]["Enums"]["notification_recipient_type"]
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_code: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          origin?: string | null
          payload_json?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_id?: string | null
          recipient_type?: Database["public"]["Enums"]["notification_recipient_type"]
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          provider: string
          redirect_to: string | null
          restaurant_id: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at?: string
          provider: string
          redirect_to?: string | null
          restaurant_id: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          provider?: string
          redirect_to?: string | null
          restaurant_id?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment: {
        Row: {
          created_at: string
          expiration_date: string | null
          external_reference: string | null
          id: string
          last_error: string | null
          order_id: string
          payment_id: string | null
          payment_intent: string | null
          payment_method: string
          payment_url: string | null
          provider: string
          qr_code: string | null
          qr_code_base64: string | null
          restaurant_id: string
          status: string
          transaction_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          external_reference?: string | null
          id?: string
          last_error?: string | null
          order_id: string
          payment_id?: string | null
          payment_intent?: string | null
          payment_method: string
          payment_url?: string | null
          provider?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          restaurant_id: string
          status?: string
          transaction_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          external_reference?: string | null
          id?: string
          last_error?: string | null
          order_id?: string
          payment_id?: string | null
          payment_intent?: string | null
          payment_method?: string
          payment_url?: string | null
          provider?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          restaurant_id?: string
          status?: string
          transaction_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_pricing_snapshot: {
        Row: {
          cashback: number
          coupon_discount: number
          created_at: string
          currency: string
          customer_total: number
          delivery_fee: number
          gateway_fee: number
          gateway_revenue: number
          id: string
          loyalty_discount: number
          order_id: string
          platform_fee: number
          platform_revenue: number
          provider: string | null
          restaurant_gross: number
          restaurant_net: number
          subtotal: number
        }
        Insert: {
          cashback?: number
          coupon_discount?: number
          created_at?: string
          currency?: string
          customer_total: number
          delivery_fee?: number
          gateway_fee?: number
          gateway_revenue?: number
          id?: string
          loyalty_discount?: number
          order_id: string
          platform_fee?: number
          platform_revenue?: number
          provider?: string | null
          restaurant_gross?: number
          restaurant_net?: number
          subtotal: number
        }
        Update: {
          cashback?: number
          coupon_discount?: number
          created_at?: string
          currency?: string
          customer_total?: number
          delivery_fee?: number
          gateway_fee?: number
          gateway_revenue?: number
          id?: string
          loyalty_discount?: number
          order_id?: string
          platform_fee?: number
          platform_revenue?: number
          provider?: string | null
          restaurant_gross?: number
          restaurant_net?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_pricing_snapshot_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_profitability: {
        Row: {
          created_at: string
          delivery_cost: number
          estimated_profit: number
          gateway_fee: number
          gross_revenue: number
          id: string
          margin_percentage: number
          net_profit: number
          order_id: string
          packaging_cost: number
          platform_fee: number
          recipe_cost: number
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          delivery_cost?: number
          estimated_profit?: number
          gateway_fee?: number
          gross_revenue?: number
          id?: string
          margin_percentage?: number
          net_profit?: number
          order_id: string
          packaging_cost?: number
          platform_fee?: number
          recipe_cost?: number
          restaurant_id: string
        }
        Update: {
          created_at?: string
          delivery_cost?: number
          estimated_profit?: number
          gateway_fee?: number
          gross_revenue?: number
          id?: string
          margin_percentage?: number
          net_profit?: number
          order_id?: string
          packaging_cost?: number
          platform_fee?: number
          recipe_cost?: number
          restaurant_id?: string
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          created_at: string
          current_status: string
          id: string
          metadata: Json
          order_id: string
          performed_by: string | null
          performed_by_type: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string
          current_status: string
          id?: string
          metadata?: Json
          order_id: string
          performed_by?: string | null
          performed_by_type?: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string
          current_status?: string
          id?: string
          metadata?: Json
          order_id?: string
          performed_by?: string | null
          performed_by_type?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          loyalty_discount: number
          loyalty_points_consumed: number
          loyalty_points_reserved: number
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
          loyalty_discount?: number
          loyalty_points_consumed?: number
          loyalty_points_reserved?: number
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
          loyalty_discount?: number
          loyalty_points_consumed?: number
          loyalty_points_reserved?: number
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
      payment_event_queue: {
        Row: {
          created_at: string
          event_id: string
          id: string
          last_error: string | null
          locked: boolean
          next_retry: string | null
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          last_error?: string | null
          locked?: boolean
          next_retry?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          last_error?: string | null
          locked?: boolean
          next_retry?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_event_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "payment_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          level: string
          message: string
          payment_id: string | null
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          level?: string
          message: string
          payment_id?: string | null
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          level?: string
          message?: string
          payment_id?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          provider_name: string
          supports_credit: boolean
          supports_pix: boolean
          supports_refund: boolean
          supports_split: boolean
          supports_subscription: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          provider_name: string
          supports_credit?: boolean
          supports_pix?: boolean
          supports_refund?: boolean
          supports_split?: boolean
          supports_subscription?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          provider_name?: string
          supports_credit?: boolean
          supports_pix?: boolean
          supports_refund?: boolean
          supports_split?: boolean
          supports_subscription?: boolean
        }
        Relationships: []
      }
      payment_reconciliation: {
        Row: {
          created_at: string
          currency: string
          difference_amount: number | null
          expected_total: number | null
          external_reference: string | null
          gateway_fee: number | null
          gateway_gross_amount: number | null
          id: string
          localix_amount: number | null
          metadata: Json
          order_id: string | null
          payment_id: string | null
          platform_fee: number | null
          provider: string
          received_total: number | null
          reconciled: boolean
          reconciled_at: string | null
          restaurant_amount: number | null
          status: Database["public"]["Enums"]["reconciliation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          difference_amount?: number | null
          expected_total?: number | null
          external_reference?: string | null
          gateway_fee?: number | null
          gateway_gross_amount?: number | null
          id?: string
          localix_amount?: number | null
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          platform_fee?: number | null
          provider?: string
          received_total?: number | null
          reconciled?: boolean
          reconciled_at?: string | null
          restaurant_amount?: number | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          difference_amount?: number | null
          expected_total?: number | null
          external_reference?: string | null
          gateway_fee?: number | null
          gateway_gross_amount?: number | null
          id?: string
          localix_amount?: number | null
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          platform_fee?: number | null
          provider?: string
          received_total?: number | null
          reconciled?: boolean
          reconciled_at?: string | null
          restaurant_amount?: number | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_split: {
        Row: {
          created_at: string
          error_message: string | null
          gateway_fee: number
          id: string
          metadata: Json
          order_id: string | null
          payment_id: string | null
          platform_amount: number
          processed_at: string | null
          provider: string
          restaurant_amount: number
          restaurant_id: string | null
          split_reference: string | null
          status: Database["public"]["Enums"]["split_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          gateway_fee?: number
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          platform_amount?: number
          processed_at?: string | null
          provider?: string
          restaurant_amount?: number
          restaurant_id?: string | null
          split_reference?: string | null
          status?: Database["public"]["Enums"]["split_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          gateway_fee?: number
          id?: string
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          platform_amount?: number
          processed_at?: string | null
          provider?: string
          restaurant_amount?: number
          restaurant_id?: string | null
          split_reference?: string | null
          status?: Database["public"]["Enums"]["split_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_split_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_split_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_split_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          action: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string | null
          external_reference: string | null
          id: string
          payload_json: Json
          processed: boolean
          processed_at: string | null
          processing_attempts: number
          provider: string
          resource_id: string | null
          signature: string | null
          updated_at: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          external_reference?: string | null
          id?: string
          payload_json?: Json
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          provider?: string
          resource_id?: string | null
          signature?: string | null
          updated_at?: string
        }
        Update: {
          action?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string | null
          external_reference?: string | null
          id?: string
          payload_json?: Json
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          provider?: string
          resource_id?: string | null
          signature?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          external_id: string | null
          id: string
          method: string
          net_amount: number
          order_id: string | null
          paid_at: string | null
          payer_email: string | null
          platform_fee: number
          provider: string
          qr_code: string | null
          qr_code_base64: string | null
          raw: Json | null
          restaurant_id: string
          status: string
          ticket_url: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          method: string
          net_amount?: number
          order_id?: string | null
          paid_at?: string | null
          payer_email?: string | null
          platform_fee?: number
          provider?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          raw?: Json | null
          restaurant_id: string
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          method?: string
          net_amount?: number
          order_id?: string | null
          paid_at?: string | null
          payer_email?: string | null
          platform_fee?: number
          provider?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          raw?: Json | null
          restaurant_id?: string
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          fee_above_30: number
          fee_up_to_30: number
          id: boolean
          min_order: number
          monthly_fee: number
          updated_at: string
        }
        Insert: {
          fee_above_30?: number
          fee_up_to_30?: number
          id?: boolean
          min_order?: number
          monthly_fee?: number
          updated_at?: string
        }
        Update: {
          fee_above_30?: number
          fee_up_to_30?: number
          id?: boolean
          min_order?: number
          monthly_fee?: number
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
          currency: string
          default_gateway: string
          delivery_fee_default: number
          domain: string | null
          fixed_fee: number
          gateway_enabled: Json
          id: boolean
          logo_url: string | null
          min_order: number
          minimum_order: number
          name: string
          platform_fee_above_30: number
          platform_fee_until_30: number
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
          currency?: string
          default_gateway?: string
          delivery_fee_default?: number
          domain?: string | null
          fixed_fee?: number
          gateway_enabled?: Json
          id?: boolean
          logo_url?: string | null
          min_order?: number
          minimum_order?: number
          name?: string
          platform_fee_above_30?: number
          platform_fee_until_30?: number
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
          currency?: string
          default_gateway?: string
          delivery_fee_default?: number
          domain?: string | null
          fixed_fee?: number
          gateway_enabled?: Json
          id?: boolean
          logo_url?: string | null
          min_order?: number
          minimum_order?: number
          name?: string
          platform_fee_above_30?: number
          platform_fee_until_30?: number
          primary_color?: string | null
          tier_fees?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          product_id: string
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          product_id: string
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          product_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_audit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_audit_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_audit_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_insights: {
        Row: {
          created_at: string
          description: string | null
          id: string
          insight_type: Database["public"]["Enums"]["product_insight_type"]
          metadata: Json
          product_id: string | null
          restaurant_id: string
          severity: Database["public"]["Enums"]["product_insight_severity"]
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          insight_type: Database["public"]["Enums"]["product_insight_type"]
          metadata?: Json
          product_id?: string | null
          restaurant_id: string
          severity?: Database["public"]["Enums"]["product_insight_severity"]
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          insight_type?: Database["public"]["Enums"]["product_insight_type"]
          metadata?: Json
          product_id?: string | null
          restaurant_id?: string
          severity?: Database["public"]["Enums"]["product_insight_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_insights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_insights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          is_primary: boolean
          product_id: string
          restaurant_id: string
          storage_path: string | null
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id: string
          restaurant_id: string
          storage_path?: string | null
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          product_id?: string
          restaurant_id?: string
          storage_path?: string | null
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          depends_on_group_id: string | null
          depends_on_option_id: string | null
          description: string | null
          display_order: number
          id: string
          max_selection: number
          metadata: Json
          min_selection: number
          name: string
          price_strategy: Database["public"]["Enums"]["product_price_strategy"]
          product_id: string
          required: boolean
          type: Database["public"]["Enums"]["product_option_group_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          depends_on_group_id?: string | null
          depends_on_option_id?: string | null
          description?: string | null
          display_order?: number
          id?: string
          max_selection?: number
          metadata?: Json
          min_selection?: number
          name: string
          price_strategy?: Database["public"]["Enums"]["product_price_strategy"]
          product_id: string
          required?: boolean
          type?: Database["public"]["Enums"]["product_option_group_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          depends_on_group_id?: string | null
          depends_on_option_id?: string | null
          description?: string | null
          display_order?: number
          id?: string
          max_selection?: number
          metadata?: Json
          min_selection?: number
          name?: string
          price_strategy?: Database["public"]["Enums"]["product_price_strategy"]
          product_id?: string
          required?: boolean
          type?: Database["public"]["Enums"]["product_option_group_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_depends_on_group_id_fkey"
            columns: ["depends_on_group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          group_id: string
          id: string
          image_url: string | null
          inventory_reference: string | null
          max_quantity: number
          metadata: Json
          name: string
          price_adjustment: number
          recipe_reference: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          group_id: string
          id?: string
          image_url?: string | null
          inventory_reference?: string | null
          max_quantity?: number
          metadata?: Json
          name: string
          price_adjustment?: number
          recipe_reference?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          group_id?: string
          id?: string
          image_url?: string | null
          inventory_reference?: string | null
          max_quantity?: number
          metadata?: Json
          name?: string
          price_adjustment?: number
          recipe_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_inventory_reference_fkey"
            columns: ["inventory_reference"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_recipe_reference_fkey"
            columns: ["recipe_reference"]
            isOneToOne: false
            referencedRelation: "product_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_profitability: {
        Row: {
          created_at: string
          estimated_profit: number
          gross_margin: number
          id: string
          last_calculated_at: string
          net_margin: number
          product_id: string
          recipe_cost: number
          restaurant_id: string
          sale_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_profit?: number
          gross_margin?: number
          id?: string
          last_calculated_at?: string
          net_margin?: number
          product_id: string
          recipe_cost?: number
          restaurant_id: string
          sale_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_profit?: number
          gross_margin?: number
          id?: string
          last_calculated_at?: string
          net_margin?: number
          product_id?: string
          recipe_cost?: number
          restaurant_id?: string
          sale_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_recipe_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          ingredient_id: string
          loss_percentage: number
          optional: boolean
          quantity: number
          recipe_id: string
          substitute_of: string | null
          unit: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          ingredient_id: string
          loss_percentage?: number
          optional?: boolean
          quantity: number
          recipe_id: string
          substitute_of?: string | null
          unit?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          ingredient_id?: string
          loss_percentage?: number
          optional?: boolean
          quantity?: number
          recipe_id?: string
          substitute_of?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "product_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_items_substitute_of_fkey"
            columns: ["substitute_of"]
            isOneToOne: false
            referencedRelation: "product_recipe_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipe_versions: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          recipe_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          recipe_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          recipe_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "product_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          preparation_time: number | null
          product_id: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["recipe_status"]
          updated_at: string
          variation_key: string | null
          version: number
          yield_quantity: number
          yield_unit: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          preparation_time?: number | null
          product_id?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["recipe_status"]
          updated_at?: string
          variation_key?: string | null
          version?: number
          yield_quantity?: number
          yield_unit?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          preparation_time?: number | null
          product_id?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["recipe_status"]
          updated_at?: string
          variation_key?: string | null
          version?: number
          yield_quantity?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recommendations: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          metadata: Json
          product_id: string | null
          recommendation_type: string
          related_product_id: string | null
          restaurant_id: string
          score: number
          status: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          metadata?: Json
          product_id?: string | null
          recommendation_type: string
          related_product_id?: string | null
          restaurant_id: string
          score?: number
          status?: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          metadata?: Json
          product_id?: string | null
          recommendation_type?: string
          related_product_id?: string | null
          restaurant_id?: string
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recommendations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recommendations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_versions: {
        Row: {
          changes_json: Json
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          restaurant_id: string
          status: string
          version: number
        }
        Insert: {
          changes_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          restaurant_id: string
          status: string
          version: number
        }
        Update: {
          changes_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          restaurant_id?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_versions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_versions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_code: string
          created_at: string
          expiration_date: string | null
          id: string
          manufacturing_date: string
          production_order_id: string
          quantity: number
          status: Database["public"]["Enums"]["production_batch_status"]
        }
        Insert: {
          batch_code: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          manufacturing_date?: string
          production_order_id: string
          quantity?: number
          status?: Database["public"]["Enums"]["production_batch_status"]
        }
        Update: {
          batch_code?: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          manufacturing_date?: string
          production_order_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["production_batch_status"]
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_consumption: {
        Row: {
          consumed_quantity: number
          created_at: string
          id: string
          ingredient_id: string
          loss_quantity: number
          planned_quantity: number
          production_order_id: string
        }
        Insert: {
          consumed_quantity?: number
          created_at?: string
          id?: string
          ingredient_id: string
          loss_quantity?: number
          planned_quantity?: number
          production_order_id: string
        }
        Update: {
          consumed_quantity?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          loss_quantity?: number
          planned_quantity?: number
          production_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_consumption_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumption_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_losses: {
        Row: {
          cost: number
          created_at: string
          id: string
          ingredient_id: string | null
          production_order_id: string
          quantity: number
          reason: string | null
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          ingredient_id?: string | null
          production_order_id: string
          quantity: number
          reason?: string | null
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          ingredient_id?: string | null
          production_order_id?: string
          quantity?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_losses_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_losses_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          actual_finish: string | null
          actual_start: string | null
          batch_number: string | null
          created_at: string
          created_by: string | null
          expiration_date: string | null
          id: string
          metadata: Json
          notes: string | null
          planned_quantity: number
          planned_start: string | null
          produced_quantity: number
          recipe_id: string
          restaurant_id: string
          status: Database["public"]["Enums"]["production_order_status"]
          updated_at: string
        }
        Insert: {
          actual_finish?: string | null
          actual_start?: string | null
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          planned_quantity: number
          planned_start?: string | null
          produced_quantity?: number
          recipe_id: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Update: {
          actual_finish?: string | null
          actual_start?: string | null
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          planned_quantity?: number
          planned_start?: string | null
          produced_quantity?: number
          recipe_id?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "product_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      production_output: {
        Row: {
          approved_quantity: number
          created_at: string
          id: string
          produced_quantity: number
          product_id: string | null
          production_order_id: string
          rejected_quantity: number
        }
        Insert: {
          approved_quantity?: number
          created_at?: string
          id?: string
          produced_quantity?: number
          product_id?: string | null
          production_order_id: string
          rejected_quantity?: number
        }
        Update: {
          approved_quantity?: number
          created_at?: string
          id?: string
          produced_quantity?: number
          product_id?: string | null
          production_order_id?: string
          rejected_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_output_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_output_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_rules: {
        Row: {
          created_at: string
          id: string
          operator: string
          promotion_id: string
          rule_type: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          operator?: string
          promotion_id: string
          rule_type: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          operator?: string
          promotion_id?: string
          rule_type?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "promotion_rules_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_targets: {
        Row: {
          created_at: string
          id: string
          promotion_id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          promotion_id: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          promotion_id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_targets_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_usage: {
        Row: {
          created_at: string
          customer_id: string | null
          discount_amount: number
          id: string
          order_id: string | null
          promotion_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          promotion_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_id?: string | null
          promotion_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          channel: string | null
          code: string | null
          config: Json
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["promotion_discount_type"]
          discount_value: number
          end_date: string | null
          id: string
          max_uses: number | null
          max_uses_per_customer: number | null
          name: string
          priority: number
          restaurant_id: string
          stackable: boolean
          start_date: string | null
          status: Database["public"]["Enums"]["promotion_status"]
          updated_at: string
        }
        Insert: {
          channel?: string | null
          code?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["promotion_discount_type"]
          discount_value?: number
          end_date?: string | null
          id?: string
          max_uses?: number | null
          max_uses_per_customer?: number | null
          name: string
          priority?: number
          restaurant_id: string
          stackable?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
        }
        Update: {
          channel?: string | null
          code?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promotion_discount_type"]
          discount_value?: number
          end_date?: string | null
          id?: string
          max_uses?: number | null
          max_uses_per_customer?: number | null
          name?: string
          priority?: number
          restaurant_id?: string
          stackable?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          purchase_order_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          purchase_order_id: string
          quantity: number
          total?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          purchase_order_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          expected_date: string | null
          id: string
          notes: string | null
          product_name: string
          quantity: number
          reference_price: number | null
          restaurant_id: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total: number
          total_cost: number
          unit: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          product_name: string
          quantity: number
          reference_price?: number | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total: number
          total_cost?: number
          unit?: string
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          product_name?: string
          quantity?: number
          reference_price?: number | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          total?: number
          total_cost?: number
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          items: Json
          notes: string | null
          reason: string | null
          requested_by: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["purchase_request_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["purchase_request_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["purchase_request_status"]
          updated_at?: string
        }
        Relationships: []
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
      recipe_cost_snapshot: {
        Row: {
          created_at: string
          id: string
          ingredient_cost: number
          labor_cost: number
          overhead_cost: number
          packaging_cost: number
          recipe_id: string
          recipe_version: number
          restaurant_id: string
          total_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_cost?: number
          labor_cost?: number
          overhead_cost?: number
          packaging_cost?: number
          recipe_id: string
          recipe_version?: number
          restaurant_id: string
          total_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_cost?: number
          labor_cost?: number
          overhead_cost?: number
          packaging_cost?: number
          recipe_id?: string
          recipe_version?: number
          restaurant_id?: string
          total_cost?: number
        }
        Relationships: []
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
          loyalty_settings: Json
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
          stripe_account_id: string | null
          stripe_account_status: string | null
          stripe_account_type: string | null
          stripe_charges_enabled: boolean | null
          stripe_details_submitted: boolean | null
          stripe_last_sync: string | null
          stripe_onboarding_completed: boolean | null
          stripe_payouts_enabled: boolean | null
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
          loyalty_settings?: Json
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
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_account_type?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_last_sync?: string | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
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
          loyalty_settings?: Json
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
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_account_type?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_last_sync?: string | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
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
      scheduled_reports: {
        Row: {
          created_at: string
          enabled: boolean
          export_format: string
          filters_json: Json
          frequency: string
          id: string
          last_execution: string | null
          name: string
          next_execution: string | null
          report_type: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          export_format?: string
          filters_json?: Json
          frequency: string
          id?: string
          last_execution?: string | null
          name: string
          next_execution?: string | null
          report_type: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          export_format?: string
          filters_json?: Json
          frequency?: string
          id?: string
          last_execution?: string | null
          name?: string
          next_execution?: string | null
          report_type?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          location_id: string | null
          metadata: Json
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          performed_by: string | null
          previous_stock: number
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          location_id?: string | null
          metadata?: Json
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          performed_by?: string | null
          previous_stock: number
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          location_id?: string | null
          metadata?: Json
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          new_stock?: number
          performed_by?: string | null
          previous_stock?: number
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
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
          ingredient_id: string | null
          last_purchase: string | null
          lead_time: number | null
          minimum_quantity: number | null
          name: string
          price: number
          status: string
          supplier_id: string
          supplier_sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          image_url?: string | null
          ingredient_id?: string | null
          last_purchase?: string | null
          lead_time?: number | null
          minimum_quantity?: number | null
          name: string
          price: number
          status?: string
          supplier_id: string
          supplier_sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          ingredient_id?: string | null
          last_purchase?: string | null
          lead_time?: number | null
          minimum_quantity?: number | null
          name?: string
          price?: number
          status?: string
          supplier_id?: string
          supplier_sku?: string | null
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
      supplier_quotes: {
        Row: {
          created_at: string
          delivery_time: number | null
          id: string
          ingredient_id: string
          minimum_quantity: number | null
          notes: string | null
          price: number
          restaurant_id: string
          supplier_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          delivery_time?: number | null
          id?: string
          ingredient_id: string
          minimum_quantity?: number | null
          notes?: string | null
          price: number
          restaurant_id: string
          supplier_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          delivery_time?: number | null
          id?: string
          ingredient_id?: string
          minimum_quantity?: number | null
          notes?: string | null
          price?: number
          restaurant_id?: string
          supplier_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          category: string
          city: string | null
          contact_name: string | null
          created_at: string
          delivery_days: string[] | null
          description: string | null
          document: string | null
          email: string | null
          id: string
          lead_time: number | null
          logo_url: string | null
          minimum_order_value: number | null
          name: string
          payment_terms: string | null
          phone: string | null
          preferred_supplier: boolean
          rating: number | null
          restaurant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          category: string
          city?: string | null
          contact_name?: string | null
          created_at?: string
          delivery_days?: string[] | null
          description?: string | null
          document?: string | null
          email?: string | null
          id?: string
          lead_time?: number | null
          logo_url?: string | null
          minimum_order_value?: number | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          preferred_supplier?: boolean
          rating?: number | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          category?: string
          city?: string | null
          contact_name?: string | null
          created_at?: string
          delivery_days?: string[] | null
          description?: string | null
          document?: string | null
          email?: string | null
          id?: string
          lead_time?: number | null
          logo_url?: string | null
          minimum_order_value?: number | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          preferred_supplier?: boolean
          rating?: number | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
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
      tenant_branding: {
        Row: {
          banner: string | null
          created_at: string
          favicon: string | null
          logo: string | null
          primary_color: string | null
          restaurant_id: string
          secondary_color: string | null
          social_links_json: Json
          updated_at: string
        }
        Insert: {
          banner?: string | null
          created_at?: string
          favicon?: string | null
          logo?: string | null
          primary_color?: string | null
          restaurant_id: string
          secondary_color?: string | null
          social_links_json?: Json
          updated_at?: string
        }
        Update: {
          banner?: string | null
          created_at?: string
          favicon?: string | null
          logo?: string | null
          primary_color?: string | null
          restaurant_id?: string
          secondary_color?: string | null
          social_links_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      tenant_business_settings: {
        Row: {
          accept_orders: boolean
          allow_cancellations: boolean
          automatic_order_acceptance: boolean
          business_status: string
          cancellation_time_limit: number
          created_at: string
          holidays_json: Json
          restaurant_id: string
          updated_at: string
          vacation_mode: boolean
          working_hours_json: Json
        }
        Insert: {
          accept_orders?: boolean
          allow_cancellations?: boolean
          automatic_order_acceptance?: boolean
          business_status?: string
          cancellation_time_limit?: number
          created_at?: string
          holidays_json?: Json
          restaurant_id: string
          updated_at?: string
          vacation_mode?: boolean
          working_hours_json?: Json
        }
        Update: {
          accept_orders?: boolean
          allow_cancellations?: boolean
          automatic_order_acceptance?: boolean
          business_status?: string
          cancellation_time_limit?: number
          created_at?: string
          holidays_json?: Json
          restaurant_id?: string
          updated_at?: string
          vacation_mode?: boolean
          working_hours_json?: Json
        }
        Relationships: []
      }
      tenant_config_audit: {
        Row: {
          changed_by: string | null
          created_at: string
          field: string
          group_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          restaurant_id: string
          source: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          field: string
          group_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          restaurant_id: string
          source?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          field?: string
          group_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          restaurant_id?: string
          source?: string | null
        }
        Relationships: []
      }
      tenant_config_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          group_name: string
          id: string
          restaurant_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          group_name: string
          id?: string
          restaurant_id: string
          snapshot: Json
          version: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          group_name?: string
          id?: string
          restaurant_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: []
      }
      tenant_configuration: {
        Row: {
          configuration_version: number
          created_at: string
          id: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          configuration_version?: number
          created_at?: string
          id?: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          configuration_version?: number
          created_at?: string
          id?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_delivery_settings: {
        Row: {
          accept_scheduled_orders: boolean
          created_at: string
          delivery_mode: string
          delivery_radius_km: number
          driver_assignment_mode: string
          estimated_delivery_time: number
          estimated_preparation_time: number
          maximum_simultaneous_orders: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          accept_scheduled_orders?: boolean
          created_at?: string
          delivery_mode?: string
          delivery_radius_km?: number
          driver_assignment_mode?: string
          estimated_delivery_time?: number
          estimated_preparation_time?: number
          maximum_simultaneous_orders?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          accept_scheduled_orders?: boolean
          created_at?: string
          delivery_mode?: string
          delivery_radius_km?: number
          driver_assignment_mode?: string
          estimated_delivery_time?: number
          estimated_preparation_time?: number
          maximum_simultaneous_orders?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_features: {
        Row: {
          ai_enabled: boolean
          analytics_enabled: boolean
          cashback_enabled: boolean
          coupons_enabled: boolean
          created_at: string
          loyalty_enabled: boolean
          marketing_enabled: boolean
          restaurant_id: string
          subscriptions_enabled: boolean
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          analytics_enabled?: boolean
          cashback_enabled?: boolean
          coupons_enabled?: boolean
          created_at?: string
          loyalty_enabled?: boolean
          marketing_enabled?: boolean
          restaurant_id: string
          subscriptions_enabled?: boolean
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          analytics_enabled?: boolean
          cashback_enabled?: boolean
          coupons_enabled?: boolean
          created_at?: string
          loyalty_enabled?: boolean
          marketing_enabled?: boolean
          restaurant_id?: string
          subscriptions_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tenant_notifications: {
        Row: {
          created_at: string
          notify_cancelled_order: boolean
          notify_delivery: boolean
          notify_marketing: boolean
          notify_new_order: boolean
          notify_payment: boolean
          preferred_channels_json: Json
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          notify_cancelled_order?: boolean
          notify_delivery?: boolean
          notify_marketing?: boolean
          notify_new_order?: boolean
          notify_payment?: boolean
          preferred_channels_json?: Json
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          notify_cancelled_order?: boolean
          notify_delivery?: boolean
          notify_marketing?: boolean
          notify_new_order?: boolean
          notify_payment?: boolean
          preferred_channels_json?: Json
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_payment_settings: {
        Row: {
          accept_cash: boolean
          accept_credit: boolean
          accept_pix: boolean
          accept_voucher: boolean
          created_at: string
          default_gateway: string
          delivery_fee: number
          free_delivery_enabled: boolean
          free_delivery_minimum: number | null
          maximum_order: number | null
          minimum_order: number
          payment_timeout_minutes: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          accept_cash?: boolean
          accept_credit?: boolean
          accept_pix?: boolean
          accept_voucher?: boolean
          created_at?: string
          default_gateway?: string
          delivery_fee?: number
          free_delivery_enabled?: boolean
          free_delivery_minimum?: number | null
          maximum_order?: number | null
          minimum_order?: number
          payment_timeout_minutes?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          accept_cash?: boolean
          accept_credit?: boolean
          accept_pix?: boolean
          accept_voucher?: boolean
          created_at?: string
          default_gateway?: string
          delivery_fee?: number
          free_delivery_enabled?: boolean
          free_delivery_minimum?: number | null
          maximum_order?: number | null
          minimum_order?: number
          payment_timeout_minutes?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
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
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          source: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          source?: string
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
      loyalty_apply: {
        Args: {
          _customer_id: string
          _description: string
          _metadata?: Json
          _points: number
          _reference_id: string
          _reference_type: string
          _restaurant_id: string
          _source: string
          _tx_type: string
        }
        Returns: string
      }
      loyalty_commit_reserve: {
        Args: { _order_id: string }
        Returns: undefined
      }
      loyalty_expire_points: { Args: never; Returns: number }
      loyalty_reserve: {
        Args: {
          _customer_id: string
          _order_id: string
          _points: number
          _restaurant_id: string
        }
        Returns: string
      }
      loyalty_rollback_reserve: {
        Args: { _order_id: string }
        Returns: undefined
      }
      loyalty_scan_expiring: { Args: never; Returns: number }
      order_apply_transition: {
        Args: {
          _actor_id: string
          _actor_type: string
          _expected_from: string
          _metadata: Json
          _next_status: string
          _order_id: string
          _reason: string
        }
        Returns: Json
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
        | "delivery_driver"
      delivery_driver_status: "ativo" | "inativo" | "afastado"
      delivery_driver_vehicle: "moto" | "bicicleta" | "carro" | "a_pe"
      ledger_status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED"
      ledger_transaction_type:
        | "ORDER_CREATED"
        | "PAYMENT_PENDING"
        | "PAYMENT_APPROVED"
        | "PAYMENT_FAILED"
        | "PLATFORM_FEE"
        | "GATEWAY_FEE"
        | "RESTAURANT_RECEIVABLE"
        | "REFUND"
        | "CHARGEBACK"
        | "PAYOUT"
        | "ADJUSTMENT"
      notification_channel:
        | "IN_APP"
        | "PUSH"
        | "EMAIL"
        | "SMS"
        | "WHATSAPP"
        | "WEBSOCKET"
      notification_priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL"
      notification_recipient_type:
        | "customer"
        | "restaurant"
        | "admin"
        | "courier"
        | "system"
      notification_status:
        | "PENDING"
        | "PROCESSING"
        | "SENT"
        | "FAILED"
        | "RETRY"
        | "DEAD_LETTER"
      product_insight_severity: "info" | "warning" | "critical"
      product_insight_type:
        | "BEST_SELLER"
        | "LOW_SELLER"
        | "HIGH_MARGIN"
        | "LOW_MARGIN"
        | "OUT_OF_STOCK"
        | "PRICE_REVIEW"
        | "PROMOTION"
        | "CROSS_SELL"
        | "UPSELL"
      product_option_group_type: "SINGLE" | "MULTIPLE" | "QUANTITY" | "BOOLEAN"
      product_price_strategy: "SUM" | "AVERAGE" | "MAX" | "FIXED" | "CUSTOM"
      production_batch_status: "ACTIVE" | "CONSUMED" | "EXPIRED" | "DISCARDED"
      production_order_status:
        | "PLANNED"
        | "IN_PROGRESS"
        | "PAUSED"
        | "COMPLETED"
        | "CANCELLED"
        | "FAILED"
      promotion_discount_type:
        | "FIXED_AMOUNT"
        | "PERCENTAGE"
        | "FIXED_PRICE"
        | "BUY_X_GET_Y"
        | "FREE_ITEM"
        | "FREE_DELIVERY"
      promotion_status:
        | "DRAFT"
        | "SCHEDULED"
        | "ACTIVE"
        | "PAUSED"
        | "EXPIRED"
        | "ARCHIVED"
      purchase_order_status:
        | "DRAFT"
        | "PENDING"
        | "APPROVED"
        | "ORDERED"
        | "RECEIVED"
        | "CANCELLED"
      purchase_request_status: "OPEN" | "APPROVED" | "REJECTED" | "ORDERED"
      recipe_status: "DRAFT" | "ACTIVE" | "ARCHIVED"
      reconciliation_status:
        | "PENDING"
        | "MATCHED"
        | "DIVERGENT"
        | "FAILED"
        | "MANUAL_REVIEW"
      split_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "MANUAL_REVIEW"
      stock_movement_type:
        | "ENTRY"
        | "EXIT"
        | "RESERVE"
        | "RELEASE"
        | "LOSS"
        | "ADJUSTMENT"
        | "TRANSFER"
        | "PRODUCTION"
        | "SALE"
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
        "delivery_driver",
      ],
      delivery_driver_status: ["ativo", "inativo", "afastado"],
      delivery_driver_vehicle: ["moto", "bicicleta", "carro", "a_pe"],
      ledger_status: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"],
      ledger_transaction_type: [
        "ORDER_CREATED",
        "PAYMENT_PENDING",
        "PAYMENT_APPROVED",
        "PAYMENT_FAILED",
        "PLATFORM_FEE",
        "GATEWAY_FEE",
        "RESTAURANT_RECEIVABLE",
        "REFUND",
        "CHARGEBACK",
        "PAYOUT",
        "ADJUSTMENT",
      ],
      notification_channel: [
        "IN_APP",
        "PUSH",
        "EMAIL",
        "SMS",
        "WHATSAPP",
        "WEBSOCKET",
      ],
      notification_priority: ["LOW", "NORMAL", "HIGH", "CRITICAL"],
      notification_recipient_type: [
        "customer",
        "restaurant",
        "admin",
        "courier",
        "system",
      ],
      notification_status: [
        "PENDING",
        "PROCESSING",
        "SENT",
        "FAILED",
        "RETRY",
        "DEAD_LETTER",
      ],
      product_insight_severity: ["info", "warning", "critical"],
      product_insight_type: [
        "BEST_SELLER",
        "LOW_SELLER",
        "HIGH_MARGIN",
        "LOW_MARGIN",
        "OUT_OF_STOCK",
        "PRICE_REVIEW",
        "PROMOTION",
        "CROSS_SELL",
        "UPSELL",
      ],
      product_option_group_type: ["SINGLE", "MULTIPLE", "QUANTITY", "BOOLEAN"],
      product_price_strategy: ["SUM", "AVERAGE", "MAX", "FIXED", "CUSTOM"],
      production_batch_status: ["ACTIVE", "CONSUMED", "EXPIRED", "DISCARDED"],
      production_order_status: [
        "PLANNED",
        "IN_PROGRESS",
        "PAUSED",
        "COMPLETED",
        "CANCELLED",
        "FAILED",
      ],
      promotion_discount_type: [
        "FIXED_AMOUNT",
        "PERCENTAGE",
        "FIXED_PRICE",
        "BUY_X_GET_Y",
        "FREE_ITEM",
        "FREE_DELIVERY",
      ],
      promotion_status: [
        "DRAFT",
        "SCHEDULED",
        "ACTIVE",
        "PAUSED",
        "EXPIRED",
        "ARCHIVED",
      ],
      purchase_order_status: [
        "DRAFT",
        "PENDING",
        "APPROVED",
        "ORDERED",
        "RECEIVED",
        "CANCELLED",
      ],
      purchase_request_status: ["OPEN", "APPROVED", "REJECTED", "ORDERED"],
      recipe_status: ["DRAFT", "ACTIVE", "ARCHIVED"],
      reconciliation_status: [
        "PENDING",
        "MATCHED",
        "DIVERGENT",
        "FAILED",
        "MANUAL_REVIEW",
      ],
      split_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "MANUAL_REVIEW",
      ],
      stock_movement_type: [
        "ENTRY",
        "EXIT",
        "RESERVE",
        "RELEASE",
        "LOSS",
        "ADJUSTMENT",
        "TRANSFER",
        "PRODUCTION",
        "SALE",
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
