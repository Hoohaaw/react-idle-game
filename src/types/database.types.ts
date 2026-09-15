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
      craft_runs: {
        Row: {
          ends_at: string
          player_id: string
          recipe_def_id: string
          started_at: string
        }
        Insert: never // all writes go through the RPCs — no direct client insert (ADR-0003)
        Update: never
        Relationships: []
      }
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
      group_runs: {
        Row: {
          current_stage_index: number
          def_key: string
          kind: string
          last_cleared_at: string | null
          party: string[]
          player_id: string
          stage_ends_at: string | null
          stage_started_at: string | null
          status: string
        }
        Insert: never
        Update: never
        Relationships: []
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
          skills: Json
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
          skills?: Json
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
          skills?: Json
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
          achievement_counters: Json
          achievements: Json
          ascendant_milestones: Json
          ascendant_shards: number
          ascendant_shards_earned_total: number
          ascendant_shop: Json
          created_at: string
          currencies: Json
          days_played: number
          echo_shop: Json
          echoes: number
          infirmary_level: number
          last_login_date: string | null
          lifetime_stats: Json
          map_progress: Json
          player_id: string
          reset_count: number
          resources: Json
          transcend_count: number
          unlocked_characters: Json
        }
        Insert: {
          achievement_counters?: Json
          achievements?: Json
          ascendant_milestones?: Json
          ascendant_shards?: number
          ascendant_shards_earned_total?: number
          ascendant_shop?: Json
          created_at?: string
          currencies?: Json
          days_played?: number
          echo_shop?: Json
          echoes?: number
          infirmary_level?: number
          last_login_date?: string | null
          lifetime_stats?: Json
          map_progress?: Json
          player_id: string
          reset_count?: number
          resources?: Json
          transcend_count?: number
          unlocked_characters?: Json
        }
        Update: {
          achievement_counters?: Json
          achievements?: Json
          ascendant_milestones?: Json
          ascendant_shards?: number
          ascendant_shards_earned_total?: number
          ascendant_shop?: Json
          created_at?: string
          currencies?: Json
          days_played?: number
          echo_shop?: Json
          echoes?: number
          infirmary_level?: number
          last_login_date?: string | null
          lifetime_stats?: Json
          map_progress?: Json
          player_id?: string
          reset_count?: number
          resources?: Json
          transcend_count?: number
          unlocked_characters?: Json
        }
        Relationships: []
      }
      skill_assignments: {
        Row: {
          id: string
          last_collected_at: string
          player_character_id: string
          player_id: string
          skill_key: string
        }
        Insert: {
          id?: string
          last_collected_at?: string
          player_character_id: string
          player_id: string
          skill_key: string
        }
        Update: {
          id?: string
          last_collected_at?: string
          player_character_id?: string
          player_id?: string
          skill_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_assignments_player_character_id_fkey"
            columns: ["player_character_id"]
            isOneToOne: true
            referencedRelation: "player_characters"
            referencedColumns: ["id"]
          },
        ]
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
      check_achievements: {
        Args: {
          p_achievement_counters: Json
          p_claimed: Json
          p_days_played: number
          p_lifetime_stats: Json
          p_reset_count: number
          p_shards_earned_total: number
          p_transcend_count: number
          p_unlocked_character_count: number
        }
        Returns: Json
      }
      check_ascendant_milestones: {
        Args: {
          p_claimed: Json
          p_lifetime_stats: Json
          p_transcend_count: number
        }
        Returns: Json
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
      claim_craft: {
        Args: {
          p_player: string
          p_recipe_def_id: string
          p_result_item_def_id: string
          p_result_rarity: string
        }
        Returns: Json
      }
      claim_group_stage: {
        Args: {
          p_char_updates: Json
          p_currencies: Json
          p_def_key: string
          p_is_last_stage: boolean
          p_kind: string
          p_loot: Json
          p_player: string
          p_resources: Json
          p_won: boolean
        }
        Returns: Json
      }
      claim_mission: {
        Args: {
          p_char_updates: Json
          p_currencies: Json
          p_lifetime_stats?: Json
          p_loot: Json
          p_map_key?: string
          p_newly_unlocked?: string[]
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
          p_lifetime_stats?: Json
          p_new_last_collected_at: string
          p_newly_unlocked?: string[]
          p_player: string
          p_resource: string
          p_stop: boolean
        }
        Returns: Json
      }
      collect_skill: {
        Args: {
          p_assignment_id: string
          p_new_last_collected_at: string
          p_new_level: number
          p_new_xp: number
          p_player: string
          p_skill_key: string
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
      purchase_ascendant_shop_node: {
        Args: { p_cost: number; p_node_key: string; p_player: string }
        Returns: Json
      }
      purchase_echo_shop_node: {
        Args: { p_cost: number; p_node_key: string; p_player: string }
        Returns: Json
      }
      record_login: { Args: { p_player: string }; Returns: Json }
      recruit_character: {
        Args: {
          p_char_key: string
          p_character_def_id: string
          p_condition_exists: boolean
          p_gold_cost: number
          p_player: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "player_characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_player: { Args: { p_player: string }; Returns: Json }
      respec_blessings: {
        Args: { p_char: string; p_cost: number; p_player: string }
        Returns: Json
      }
      start_craft: {
        Args: {
          p_duration_seconds: number
          p_item_reagents: Json
          p_player: string
          p_recipe_def_id: string
          p_resource_reagents: Json
        }
        Returns: {
          ends_at: string
          player_id: string
          recipe_def_id: string
          started_at: string
        }
        SetofOptions: {
          from: "*"
          to: "craft_runs"
          isOneToOne: true
          isSetofReturn: false
        }
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
      start_group_stage: {
        Args: {
          p_def_key: string
          p_duration_seconds: number
          p_kind: string
          p_lockout: string
          p_map_gate?: string
          p_party: string[]
          p_player: string
          p_stage_index: number
          p_total_stages: number
        }
        Returns: {
          current_stage_index: number
          def_key: string
          kind: string
          last_cleared_at: string | null
          party: string[]
          player_id: string
          stage_ends_at: string | null
          stage_started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "group_runs"
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
      start_skill: {
        Args: { p_char: string; p_player: string; p_skill_key: string }
        Returns: {
          id: string
          last_collected_at: string
          player_character_id: string
          player_id: string
          skill_key: string
        }
        SetofOptions: {
          from: "*"
          to: "skill_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transcend_player: {
        Args: { p_player: string; p_protected_ids: string[] }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
