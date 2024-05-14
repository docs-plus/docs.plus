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
        ]
      }
      channels: {
        Row: {
          allow_emoji_reactions: boolean | null
          created_at: string
          created_by: string
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
          created_by: string
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
          created_by?: string
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
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
            foreignKeyName: "notifications_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
          pinned_by: string
        }
        Insert: {
          channel_id: string
          content: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          channel_id?: string
          content?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
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
        ]
      }
      users: {
        Row: {
          about: string | null
          avatar_url: string | null
          company: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          online_at: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string
          username: string
          website: string | null
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          online_at?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string
          username: string
          website?: string | null
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          online_at?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string
          username?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      mark_messages_as_read: {
        Args: {
          p_channel_id: string
          p_message_id: string
        }
        Returns: undefined
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
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
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

