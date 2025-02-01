export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      channel_members: {
        Row: {
          channel_id: string
          channel_member_role:
            | Database["public"]["Enums"]["channel_member_role"]
            | null
          created_at: string
          id: string
          joined_at: string
          last_read_message_id: string | null
          last_read_update_at: string | null
          left_at: string | null
          member_id: string
          mute_in_app_notifications: boolean | null
          unread_message_count: number | null
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          channel_member_role?:
            | Database["public"]["Enums"]["channel_member_role"]
            | null
          created_at?: string
          id?: string
          joined_at?: string
          last_read_message_id?: string | null
          last_read_update_at?: string | null
          left_at?: string | null
          member_id: string
          mute_in_app_notifications?: boolean | null
          unread_message_count?: number | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          channel_member_role?:
            | Database["public"]["Enums"]["channel_member_role"]
            | null
          created_at?: string
          id?: string
          joined_at?: string
          last_read_message_id?: string | null
          last_read_update_at?: string | null
          left_at?: string | null
          member_id?: string
          mute_in_app_notifications?: boolean | null
          unread_message_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      channel_message_counts: {
        Row: {
          channel_id: string
          message_count: number
          workspace_id: string
        }
        Insert: {
          channel_id: string
          message_count?: number
          workspace_id: string
        }
        Update: {
          channel_id?: string
          message_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_message_counts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_counts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          allow_emoji_reactions: boolean | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_avatar_set: boolean | null
          last_activity_at: string
          last_message_preview: string | null
          member_count: number
          member_limit: number | null
          metadata: Json | null
          mute_in_app_notifications: boolean | null
          name: string
          slug: string
          type: Database["public"]["Enums"]["channel_type"] | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allow_emoji_reactions?: boolean | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_avatar_set?: boolean | null
          last_activity_at?: string
          last_message_preview?: string | null
          member_count?: number
          member_limit?: number | null
          metadata?: Json | null
          mute_in_app_notifications?: boolean | null
          name: string
          slug: string
          type?: Database["public"]["Enums"]["channel_type"] | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allow_emoji_reactions?: boolean | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_avatar_set?: boolean | null
          last_activity_at?: string
          last_message_preview?: string | null
          member_count?: number
          member_limit?: number | null
          metadata?: Json | null
          mute_in_app_notifications?: boolean | null
          name?: string
          slug?: string
          type?: Database["public"]["Enums"]["channel_type"] | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_test_runs: {
        Row: {
          id: number
          run_at: string | null
        }
        Insert: {
          id?: number
          run_at?: string | null
        }
        Update: {
          id?: number
          run_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel_id: string
          content: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          html: string | null
          id: string
          is_thread_root: boolean | null
          medias: Json | null
          metadata: Json | null
          origin_message_id: string | null
          reactions: Json | null
          readed_at: string | null
          replied_message_preview: string | null
          reply_to_message_id: string | null
          thread_depth: number | null
          thread_id: string | null
          thread_owner_id: string | null
          type: Database["public"]["Enums"]["message_type"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          html?: string | null
          id?: string
          is_thread_root?: boolean | null
          medias?: Json | null
          metadata?: Json | null
          origin_message_id?: string | null
          reactions?: Json | null
          readed_at?: string | null
          replied_message_preview?: string | null
          reply_to_message_id?: string | null
          thread_depth?: number | null
          thread_id?: string | null
          thread_owner_id?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          html?: string | null
          id?: string
          is_thread_root?: boolean | null
          medias?: Json | null
          metadata?: Json | null
          origin_message_id?: string | null
          reactions?: Json | null
          readed_at?: string | null
          replied_message_preview?: string | null
          reply_to_message_id?: string | null
          thread_depth?: number | null
          thread_id?: string | null
          thread_owner_id?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_origin_message_id_fkey"
            columns: ["origin_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_owner_id_fkey"
            columns: ["thread_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_owner_id_fkey"
            columns: ["thread_owner_id"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          channel_id: string | null
          created_at: string
          id: string
          message_id: string | null
          message_preview: string | null
          readed_at: string | null
          receiver_user_id: string
          sender_user_id: string | null
          type: Database["public"]["Enums"]["notification_category"]
        }
        Insert: {
          action_url?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          message_preview?: string | null
          readed_at?: string | null
          receiver_user_id: string
          sender_user_id?: string | null
          type: Database["public"]["Enums"]["notification_category"]
        }
        Update: {
          action_url?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          message_preview?: string | null
          readed_at?: string | null
          receiver_user_id?: string
          sender_user_id?: string | null
          type?: Database["public"]["Enums"]["notification_category"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_receiver_user_id_fkey"
            columns: ["receiver_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_receiver_user_id_fkey"
            columns: ["receiver_user_id"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pinned_messages: {
        Row: {
          channel_id: string
          content: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string | null
        }
        Insert: {
          channel_id: string
          content: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Update: {
          channel_id?: string
          content?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_updated_at: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          online_at: string | null
          profile_data: Json
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          online_at?: string | null
          profile_data?: Json
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          online_at?: string | null
          profile_data?: Json
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workspace_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      workspace_users: {
        Row: {
          avatar_updated_at: string | null
          avatar_url: string | null
          display_name: string | null
          full_name: string | null
          joined_at: string | null
          user_id: string | null
          username: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_direct_message_channel: {
        Args: {
          workspace_uid: string
          user_id: string
        }
        Returns: Json
      }
      create_thread_message: {
        Args: {
          p_content: string
          p_html: string
          p_thread_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      fetch_mentioned_users: {
        Args: {
          _workspace_id: string
          _username: string
        }
        Returns: {
          id: string
          username: string
          full_name: string
          display_name: string
          avatar_url: string
          avatar_updated_at: string
          created_at: string
        }[]
      }
      fetch_workspace_users: {
        Args: {
          _workspace_id: string
          _search_term: string
        }
        Returns: {
          username: string
          full_name: string
          display_name: string
          avatar_url: string
          avatar_updated_at: string
        }[]
      }
      get_channel_aggregate_data: {
        Args: {
          input_channel_id: string
          message_limit?: number
        }
        Returns: {
          channel_info: Json
          last_messages: Json
          pinned_messages: Json
          is_user_channel_member: boolean
          channel_member_info: Json
          total_messages_since_last_read: number
          unread_message: boolean
          last_read_message_id: string
          last_read_message_timestamp: string
        }[]
      }
      get_channel_messages_paginated: {
        Args: {
          input_channel_id: string
          page: number
          page_size?: number
        }
        Returns: {
          messages: Json
        }[]
      }
      get_unread_count: {
        Args: {
          _workspace_id?: string
        }
        Returns: number
      }
      get_unread_notif_count: {
        Args: {
          _workspace_id?: string
        }
        Returns: number
      }
      get_unread_notifications_paginated: {
        Args: {
          _workspace_id?: string
          _type?: string
          _page?: number
          _page_size?: number
        }
        Returns: Json[]
      }
      get_workspace_users: {
        Args: {
          workspace_id_param: string
        }
        Returns: {
          user_id: string
          username: string
          full_name: string
          display_name: string
          avatar_url: string
          avatar_updated_at: string
          joined_at: string
        }[]
      }
      mark_messages_as_read: {
        Args: {
          p_channel_id: string
          p_message_id: string
        }
        Returns: undefined
      }
      message_counter_batch_worker: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      notifications_summary: {
        Args: {
          _workspace_id?: string
        }
        Returns: Json
      }
      truncate_content: {
        Args: {
          input_content: string
          max_length?: number
        }
        Returns: string
      }
    }
    Enums: {
      app_permission:
        | "channels.create"
        | "channels.delete"
        | "channels.edit"
        | "messages.create"
        | "messages.delete"
        | "messages.edit"
        | "users.view"
        | "users.edit"
        | "users.delete"
        | "roles.create"
        | "roles.edit"
        | "roles.delete"
      app_role: "admin" | "moderator" | "member" | "guest"
      channel_member_role: "MEMBER" | "ADMIN" | "MODERATOR" | "GUEST"
      channel_type:
        | "PUBLIC"
        | "PRIVATE"
        | "BROADCAST"
        | "ARCHIVE"
        | "DIRECT"
        | "GROUP"
        | "THREAD"
      message_type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "link"
        | "giphy"
        | "file"
        | "notification"
      notification_category:
        | "mention"
        | "message"
        | "reply"
        | "reaction"
        | "thread_message"
        | "channel_event"
        | "direct_message"
        | "invitation"
        | "system_alert"
      notification_type:
        | "message"
        | "channel_invite"
        | "mention"
        | "reply"
        | "thread_update"
        | "channel_update"
        | "member_join"
        | "member_leave"
        | "user_activity"
        | "task_assignment"
        | "event_reminder"
        | "system_update"
        | "security_alert"
        | "like_reaction"
        | "feedback_request"
        | "performance_insight"
      user_status: "ONLINE" | "OFFLINE" | "AWAY" | "BUSY" | "INVISIBLE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

