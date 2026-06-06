export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          sku: string
          category: string
          cost_price: number
          sell_price: number
          stock_qty: number
          low_stock_threshold: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sku: string
          category: string
          cost_price?: number
          sell_price?: number
          stock_qty?: number
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sku?: string
          category?: string
          cost_price?: number
          sell_price?: number
          stock_qty?: number
          low_stock_threshold?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          id: string
          auth_user_id: string | null
          name: string
          email: string
          role: string
          is_active: boolean
          telegram_user_id: number | null
          telegram_username: string | null
          created_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          name: string
          email: string
          role?: string
          is_active?: boolean
          telegram_user_id?: number | null
          telegram_username?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          name?: string
          email?: string
          role?: string
          is_active?: boolean
          telegram_user_id?: number | null
          telegram_username?: string | null
          created_at?: string
        }
        Relationships: []
      }
      order_daily_counters: {
        Row: {
          order_date: string
          last_value: number
        }
        Insert: {
          order_date: string
          last_value: number
        }
        Update: {
          order_date?: string
          last_value?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          address: string | null
          platform: string
          tags: string[]
          notes: string | null
          kanban_stage: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          address?: string | null
          platform: string
          tags?: string[]
          notes?: string | null
          kanban_stage?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          address?: string | null
          platform?: string
          tags?: string[]
          notes?: string | null
          kanban_stage?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_id: string | null
          admin_id: string | null
          platform: string
          status: string
          invoice_date: string
          shipped_date: string | null
          total_amount: number
          total_cost: number
          shipping_fee: number
          discount: number
          net_profit: number | null
          payment_method: string | null
          tracking_number: string | null
          notes: string | null
          kanban_stage: string
          sort_order: number
          status_changed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          customer_id?: string | null
          admin_id?: string | null
          platform: string
          status?: string
          invoice_date?: string
          shipped_date?: string | null
          total_amount?: number
          total_cost?: number
          shipping_fee?: number
          discount?: number
          payment_method?: string | null
          tracking_number?: string | null
          notes?: string | null
          kanban_stage?: string
          sort_order?: number
          status_changed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          customer_id?: string | null
          admin_id?: string | null
          platform?: string
          status?: string
          invoice_date?: string
          shipped_date?: string | null
          total_amount?: number
          total_cost?: number
          shipping_fee?: number
          discount?: number
          payment_method?: string | null
          tracking_number?: string | null
          notes?: string | null
          kanban_stage?: string
          sort_order?: number
          status_changed_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_id: string | null
          product_name: string
          qty: number
          unit_price: number
          unit_cost: number
          subtotal: number | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          product_name: string
          qty?: number
          unit_price: number
          unit_cost?: number
        }
        Update: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          product_name?: string
          qty?: number
          unit_price?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          product_id: string | null
          order_id: string | null
          movement_type: string
          qty_change: number
          qty_after: number
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          order_id?: string | null
          movement_type: string
          qty_change: number
          qty_after: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string | null
          order_id?: string | null
          movement_type?: string
          qty_change?: number
          qty_after?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          id: string
          customer_id: string | null
          order_id: string | null
          admin_id: string | null
          followup_type: string
          due_date: string
          status: string
          outcome: string | null
          contacted_at: string | null
          kanban_stage: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          order_id?: string | null
          admin_id?: string | null
          followup_type: string
          due_date: string
          status?: string
          outcome?: string | null
          contacted_at?: string | null
          kanban_stage?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          order_id?: string | null
          admin_id?: string | null
          followup_type?: string
          due_date?: string
          status?: string
          outcome?: string | null
          contacted_at?: string | null
          kanban_stage?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_accounts: {
        Row: {
          id: string
          platform: string
          external_account_id: string
          display_name: string
          credentials_ciphertext: string | null
          webhook_secret_ciphertext: string | null
          is_active: boolean
          is_webhook_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          platform: string
          external_account_id: string
          display_name: string
          credentials_ciphertext?: string | null
          webhook_secret_ciphertext?: string | null
          is_active?: boolean
          is_webhook_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["platform_accounts"]["Insert"]>
        Relationships: []
      }
      platform_webhook_events: {
        Row: {
          id: string
          platform: string
          platform_account_id: string | null
          external_event_id: string
          event_type: string
          payload: Json
          headers: Json
          received_at: string
          processing_status: string
          attempts: number
          processed_at: string | null
          last_error: string | null
        }
        Insert: {
          id?: string
          platform: string
          platform_account_id?: string | null
          external_event_id: string
          event_type: string
          payload: Json
          headers?: Json
          received_at?: string
          processing_status?: string
          attempts?: number
          processed_at?: string | null
          last_error?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["platform_webhook_events"]["Insert"]>
        Relationships: []
      }
      platform_external_orders: {
        Row: {
          id: string
          platform: string
          platform_account_id: string | null
          external_order_id: string
          order_id: string | null
          external_status: string | null
          last_payload: Json
          last_synced_at: string
        }
        Insert: {
          id?: string
          platform: string
          platform_account_id?: string | null
          external_order_id: string
          order_id?: string | null
          external_status?: string | null
          last_payload?: Json
          last_synced_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["platform_external_orders"]["Insert"]>
        Relationships: []
      }
      workflow_transition_log: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          from_stage: string | null
          to_stage: string
          from_sort_order: number | null
          to_sort_order: number
          actor_admin_id: string | null
          source: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          from_stage?: string | null
          to_stage: string
          from_sort_order?: number | null
          to_sort_order: number
          actor_admin_id?: string | null
          source?: string
          metadata?: Json
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["workflow_transition_log"]["Insert"]>
        Relationships: []
      }
      telegram_chats: {
        Row: {
          id: string
          chat_id: number
          label: string
          notification_types: string[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: number
          label: string
          notification_types?: string[]
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["telegram_chats"]["Insert"]>
        Relationships: []
      }
      telegram_action_tokens: {
        Row: {
          id: string
          token_hash: string
          action: string
          entity_type: string
          entity_id: string
          target_stage: string | null
          expires_at: string
          consumed_at: string | null
          consumed_by_admin_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          token_hash: string
          action: string
          entity_type: string
          entity_id: string
          target_stage?: string | null
          expires_at: string
          consumed_at?: string | null
          consumed_by_admin_id?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["telegram_action_tokens"]["Insert"]>
        Relationships: []
      }
      telegram_notification_logs: {
        Row: {
          id: string
          chat_id: number
          event_type: string
          entity_type: string | null
          entity_id: string | null
          telegram_message_id: number | null
          status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: number
          event_type: string
          entity_type?: string | null
          entity_id?: string | null
          telegram_message_id?: number | null
          status: string
          error_message?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["telegram_notification_logs"]["Insert"]>
        Relationships: []
      }
      ad_spend: {
        Row: {
          id: string
          spend_date: string
          platform: string
          amount: number
          impressions: number | null
          clicks: number | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          spend_date: string
          platform: string
          amount?: number
          impressions?: number | null
          clicks?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          spend_date?: string
          platform?: string
          amount?: number
          impressions?: number | null
          clicks?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dead_letter_events: {
        Row: {
          id: string
          platform: string
          account_name: string | null
          external_event_id: string
          event_type: string
          attempts: number
          received_at: string
          last_error: string | null
          payload: Json
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Functions: {
      create_order_transaction: {
        Args: {
          p_admin_id: string
          p_customer: Json
          p_discount: number
          p_items: Json
          p_notes: string
          p_payment_method: string
          p_platform: string
          p_shipping_fee: number
        }
        Returns: {
          order_id: string
          order_number: string
        }[]
      }
      adjust_stock_transaction: {
        Args: {
          p_admin_id: string
          p_notes: string
          p_product_id: string
          p_qty_change: number
        }
        Returns: number
      }
      get_low_stock_products: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          low_stock_threshold: number
          name: string
          sku: string
          stock_qty: number
        }[]
      }
      get_customer_order_summaries: {
        Args: {
          p_customer_ids: string[]
        }
        Returns: {
          customer_id: string
          last_order_date: string | null
          order_count: number
          recent_orders: Json
          total_spend: number
        }[]
      }
      get_my_admin_context: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      move_order_kanban_card: {
        Args: {
          p_order_id: string
          p_to_stage: string
          p_sort_order: number
          p_expected_updated_at: string
          p_admin_id: string
          p_source?: string
        }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      move_customer_kanban_card: {
        Args: {
          p_customer_id: string
          p_to_stage: string
          p_sort_order: number
          p_expected_updated_at: string
          p_admin_id: string
          p_source?: string
        }
        Returns: Database["public"]["Tables"]["customers"]["Row"]
      }
      move_followup_kanban_card: {
        Args: {
          p_followup_id: string
          p_to_stage: string
          p_sort_order: number
          p_expected_updated_at: string
          p_admin_id: string
          p_source?: string
        }
        Returns: Database["public"]["Tables"]["followups"]["Row"]
      }
      perform_telegram_action: {
        Args: {
          p_token_hash: string
          p_telegram_user_id: number
        }
        Returns: Json
      }
      rebalance_kanban_column: {
        Args: {
          p_entity_type: string
          p_stage: string
          p_admin_id: string
        }
        Returns: undefined
      }
      replay_webhook_event: {
        Args: {
          p_event_id: string
          p_admin_id: string
        }
        Returns: undefined
      }
      dismiss_webhook_event: {
        Args: {
          p_event_id: string
          p_admin_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
