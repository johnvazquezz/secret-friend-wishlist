export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      assignments: {
        Row: {
          created_at: string;
          event_id: string;
          giver_id: string;
          receiver_id: string;
          thread_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          giver_id: string;
          receiver_id: string;
          thread_id?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          giver_id?: string;
          receiver_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_giver_id_fkey';
            columns: ['giver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_receiver_id_fkey';
            columns: ['receiver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          target_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_participants: {
        Row: {
          created_at: string;
          event_id: string;
          responded_at: string | null;
          status: Database['public']['Enums']['participation_status'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['participation_status'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['participation_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_participants_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          budget_amount: number | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string | null;
          drawn_at: string | null;
          exchange_at: string | null;
          id: string;
          location: string | null;
          name: string;
          published_at: string | null;
          registration_deadline: string | null;
          rules: string | null;
          status: Database['public']['Enums']['event_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          budget_amount?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          drawn_at?: string | null;
          exchange_at?: string | null;
          id?: string;
          location?: string | null;
          name: string;
          published_at?: string | null;
          registration_deadline?: string | null;
          rules?: string | null;
          status?: Database['public']['Enums']['event_status'];
          updated_at?: string;
        };
        Update: {
          budget_amount?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          drawn_at?: string | null;
          exchange_at?: string | null;
          id?: string;
          location?: string | null;
          name?: string;
          published_at?: string | null;
          registration_deadline?: string | null;
          rules?: string | null;
          status?: Database['public']['Enums']['event_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      exclusions: {
        Row: {
          created_at: string;
          event_id: string;
          user_a: string;
          user_b: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exclusions_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exclusions_user_a_fkey';
            columns: ['user_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exclusions_user_b_fkey';
            columns: ['user_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          author_role: Database['public']['Enums']['chat_role'];
          body: string;
          created_at: string;
          id: string;
          read_at: string | null;
          thread_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_role: Database['public']['Enums']['chat_role'];
          body: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          thread_id: string;
        };
        Update: {
          author_role?: Database['public']['Enums']['chat_role'];
          body?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['thread_id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          department: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          must_change_password: boolean;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          department?: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          must_change_password?: boolean;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          must_change_password?: boolean;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          access_code: string;
          created_at: string | null;
          id: string;
          name: string;
          updated_at: string | null;
          wishes: string | null;
        };
        ComputedFields: never;
        Insert: {
          access_code: string;
          created_at?: string | null;
          id?: string;
          name: string;
          updated_at?: string | null;
          wishes?: string | null;
        };
        Update: {
          access_code?: string;
          created_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string | null;
          wishes?: string | null;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          allergies: string | null;
          dislikes: string | null;
          likes: string | null;
          notes: string | null;
          sizes: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          allergies?: string | null;
          dislikes?: string | null;
          likes?: string | null;
          notes?: string | null;
          sizes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          allergies?: string | null;
          dislikes?: string | null;
          likes?: string | null;
          notes?: string | null;
          sizes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_items: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          position: number;
          priority: number;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          position?: number;
          priority?: number;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          position?: number;
          priority?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_event_stats: {
        Args: { p_event_id: string };
        Returns: {
          confirmed: number;
          conversations_started: number;
          declined: number;
          invited: number;
          messages_total: number;
          pending_password: number;
          with_preferences: number;
          with_wishlist: number;
        }[];
      };
      admin_set_participation: {
        Args: {
          p_event_id: string;
          p_status: Database['public']['Enums']['participation_status'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      complete_password_change: { Args: Record<PropertyKey, never>; Returns: undefined };
      draw_summary: {
        Args: { p_event_id: string };
        Returns: {
          assigned: number;
          confirmed: number;
          is_valid: boolean;
        }[];
      };
      event_is_editable: { Args: { p_event_id: string }; Returns: boolean };
      finish_event: { Args: { p_event_id: string }; Returns: undefined };
      get_my_assignment: {
        Args: { p_event_id: string };
        Returns: {
          avatar_path: string;
          department: string;
          full_name: string;
          receiver_id: string;
        }[];
      };
      get_my_recipient_preferences: {
        Args: { p_event_id: string };
        Returns: {
          allergies: string;
          dislikes: string;
          likes: string;
          notes: string;
          sizes: string;
        }[];
      };
      get_my_threads: {
        Args: { p_event_id: string };
        Returns: {
          last_message_at: string;
          my_role: Database['public']['Enums']['chat_role'];
          partner_avatar_path: string;
          partner_name: string;
          thread_id: string;
          unread: number;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      lock_event: {
        Args: { p_event_id: string; p_expected: Database['public']['Enums']['event_status'][] };
        Returns: Database['public']['Enums']['event_status'];
      };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: undefined };
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined };
      my_thread_id: {
        Args: { p_as: Database['public']['Enums']['chat_role']; p_event_id: string };
        Returns: string;
      };
      my_thread_role: {
        Args: { p_thread_id: string };
        Returns: Database['public']['Enums']['chat_role'];
      };
      notify: {
        Args: {
          p_body?: string;
          p_dedupe_key?: string;
          p_kind: string;
          p_link?: string;
          p_title: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      open_event: { Args: { p_event_id: string }; Returns: undefined };
      publish_draw: { Args: { p_event_id: string }; Returns: undefined };
      require_admin: { Args: Record<PropertyKey, never>; Returns: undefined };
      reset_draw: { Args: { p_event_id: string }; Returns: undefined };
      respond_participation: {
        Args: { p_accept: boolean; p_event_id: string };
        Returns: undefined;
      };
      run_draw: { Args: { p_event_id: string }; Returns: number };
      send_announcement: { Args: { p_body: string; p_title: string }; Returns: number };
      send_message: {
        Args: {
          p_as: Database['public']['Enums']['chat_role'];
          p_body: string;
          p_event_id: string;
        };
        Returns: string;
      };
      send_reminders: { Args: { p_now?: string }; Returns: number };
      write_audit: {
        Args: { p_action: string; p_details?: Json; p_target: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'participant' | 'admin';
      chat_role: 'giver' | 'receiver';
      event_status: 'draft' | 'open' | 'drawn' | 'published' | 'finished';
      participation_status: 'invited' | 'confirmed' | 'declined';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ['participant', 'admin'],
      chat_role: ['giver', 'receiver'],
      event_status: ['draft', 'open', 'drawn', 'published', 'finished'],
      participation_status: ['invited', 'confirmed', 'declined'],
    },
  },
} as const;
