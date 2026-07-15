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
      gather_assignments: {
        Row: {
          id: string
          last_collected_at: string
          player_character_id: string
          player_id: string
          resource_id: string
          started_at: string
        }
        Insert: {
          id?: string
          last_collected_at?: string
          player_character_id: string
          player_id: string
          resource_id: string
          started_at?: string
        }
        Update: {
          id?: string
          last_collected_at?: string
          player_character_id?: string
          player_id?: string
          resource_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gather_assignments_player_character_id_fkey"
            columns: ["player_character_id"]
            isOneToOne: true
            referencedRelation: "player_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      infirmary_admissions: {
        Row: {
          admitted_at: string
          hp_at_admission: number
          id: string
          player_character_id: string
          player_id: string
        }
        Insert: {
          admitted_at?: string
          hp_at_admission: number
          id?: string
          player_character_id: string
          player_id: string
        }
        Update: {
          admitted_at?: string
          hp_at_admission?: number
          id?: string
          player_character_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "infirmary_admissions_player_character_id_fkey"
            columns: ["player_character_id"]
            isOneToOne: true
            referencedRelation: "player_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_runs: {
        Row: {
          ends_at: string
          id: string
          mission_def_id: string
          party: string[]
          player_id: string
          started_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          mission_def_id: string
          party: string[]
          player_id: string
          started_at?: string
        }
        Update: {
          ends_at?: string
          id?: string
          mission_def_id?: string
          party?: string[]
          player_id?: string
          started_at?: string
        }
        Relationships: []
      }
      player_characters: {
        Row: {
          acquired_at: string
          blessings: Json
          character_def_id: string
          current_hp: number | null
          equipped: Json
          id: string
          level: number
          player_id: string
          xp: number
        }
        Insert: {
          acquired_at?: string
          blessings?: Json
          character_def_id: string
          current_hp?: number | null
          equipped?: Json
          id?: string
          level?: number
          player_id: string
          xp?: number
        }
        Update: {
          acquired_at?: string
          blessings?: Json
          character_def_id?: string
          current_hp?: number | null
          equipped?: Json
          id?: string
          level?: number
          player_id?: string
          xp?: number
        }
        Relationships: []
      }
      player_inventory: {
        Row: {
          acquired_at: string
          id: string
          item_def_id: string
          player_id: string
          quantity: number
          rarity: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          item_def_id: string
          player_id: string
          quantity?: number
          rarity: string
        }
        Update: {
          acquired_at?: string
          id?: string
          item_def_id?: string
          player_id?: string
          quantity?: number
          rarity?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          currencies: Json
          infirmary_level: number
          map_progress: Json
          player_id: string
          resources: Json
          transcendence_count: number
        }
        Insert: {
          created_at?: string
          currencies?: Json
          infirmary_level?: number
          map_progress?: Json
          player_id: string
          resources?: Json
          transcendence_count?: number
        }
        Update: {
          created_at?: string
          currencies?: Json
          infirmary_level?: number
          map_progress?: Json
          player_id?: string
          resources?: Json
          transcendence_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admit_infirmary: {
        Args: { p_char: string; p_max_beds: number; p_player: string }
        Returns: {
          admitted_at: string
          hp_at_admission: number
          id: string
          player_character_id: string
          player_id: string
        }
        SetofOptions: {
          from: "*"
          to: "infirmary_admissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      choose_blessing: {
        Args: {
          p_char: string
          p_choice: string
          p_player: string
          p_row: string
        }
        Returns: Json
      }
      claim_mission: {
        Args: {
          p_char_updates: Json
          p_currencies: Json
          p_loot: Json
          p_map_key?: string
          p_player: string
          p_resources: Json
          p_run_id: string
          p_stage?: number
          p_won?: boolean
        }
        Returns: Json
      }
      collect_gather: {
        Args: {
          p_assignment_id: string
          p_gained: number
          p_new_last_collected_at: string
          p_player: string
          p_resource: string
          p_stop: boolean
        }
        Returns: Json
      }
      discharge_infirmary: {
        Args: { p_char: string; p_new_current_hp: number; p_player: string }
        Returns: Json
      }
      equip_item: {
        Args: {
          p_char: string
          p_item_def_id: string
          p_player: string
          p_rarity: string
          p_required_level?: number
          p_slot_key: string
        }
        Returns: Json
      }
      start_gather: {
        Args: { p_char: string; p_player: string; p_resource_id: string }
        Returns: {
          id: string
          last_collected_at: string
          player_character_id: string
          player_id: string
          resource_id: string
          started_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gather_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_mission: {
        Args: {
          p_duration_seconds: number
          p_map_key?: string
          p_mission_def_id: string
          p_party: string[]
          p_player: string
          p_prev_map_key?: string
          p_stage?: number
        }
        Returns: {
          ends_at: string
          id: string
          mission_def_id: string
          party: string[]
          player_id: string
          started_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mission_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unequip_item: {
        Args: { p_char: string; p_player: string; p_slot_key: string }
        Returns: Json
      }
      upgrade_infirmary: {
        Args: {
          p_cost_currencies: Json
          p_cost_resources: Json
          p_new_level: number
          p_player: string
          p_settlements: Json
        }
        Returns: Json
      }
      upgrade_items: {
        Args: { p_ops: Json; p_player: string }
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
    Enums: {},
  },
} as const
