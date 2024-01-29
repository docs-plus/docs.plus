export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      channel_members: {
        Row: {
          channel_id: string;
          channel_member_role: Database["public"]["Enums"]["channel_member_role"] | null;
          created_at: string;
          joined_at: string;
          last_read_message_id: string | null;
          last_read_update: string | null;
          left_at: string | null;
          member_id: string;
          mute_in_app_notifications: boolean | null;
          unread_message_count: number | null;
          updated_at: string | null;
        };
        Insert: {
          channel_id: string;
          channel_member_role?: Database["public"]["Enums"]["channel_member_role"] | null;
          created_at?: string;
          joined_at?: string;
          last_read_message_id?: string | null;
          last_read_update?: string | null;
          left_at?: string | null;
          member_id: string;
          mute_in_app_notifications?: boolean | null;
          unread_message_count?: number | null;
          updated_at?: string | null;
        };
        Update: {
          channel_id?: string;
          channel_member_role?: Database["public"]["Enums"]["channel_member_role"] | null;
          created_at?: string;
          joined_at?: string;
          last_read_message_id?: string | null;
          last_read_update?: string | null;
          left_at?: string | null;
          member_id?: string;
          mute_in_app_notifications?: boolean | null;
          unread_message_count?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_members_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "view_channels";
            referencedColumns: ["channel_id"];
          },
          {
            foreignKeyName: "channel_members_last_read_message_id_fkey";
            columns: ["last_read_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_members_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      channels: {
        Row: {
          allow_emoji_reactions: boolean | null;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_avatar_set: boolean | null;
          last_activity_at: string;
          last_message_preview: string | null;
          member_limit: number | null;
          metadata: Json | null;
          mute_in_app_notifications: boolean | null;
          name: string;
          slug: string;
          type: Database["public"]["Enums"]["channel_type"] | null;
          workspace_id: string;
        };
        Insert: {
          allow_emoji_reactions?: boolean | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          is_avatar_set?: boolean | null;
          last_activity_at?: string;
          last_message_preview?: string | null;
          member_limit?: number | null;
          metadata?: Json | null;
          mute_in_app_notifications?: boolean | null;
          name: string;
          slug: string;
          type?: Database["public"]["Enums"]["channel_type"] | null;
          workspace_id: string;
        };
        Update: {
          allow_emoji_reactions?: boolean | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_avatar_set?: boolean | null;
          last_activity_at?: string;
          last_message_preview?: string | null;
          member_limit?: number | null;
          metadata?: Json | null;
          mute_in_app_notifications?: boolean | null;
          name?: string;
          slug?: string;
          type?: Database["public"]["Enums"]["channel_type"] | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channels_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          channel_id: string;
          content: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          html: string | null;
          id: string;
          is_thread_root: boolean | null;
          medias: Json | null;
          metadata: Json | null;
          origin_message_id: string | null;
          reactions: Json | null;
          replied_message_preview: string | null;
          reply_to_message_id: string | null;
          thread_depth: number | null;
          thread_id: string | null;
          thread_owner_user_id: string | null;
          type: Database["public"]["Enums"]["message_type"] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          channel_id: string;
          content?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          html?: string | null;
          id?: string;
          is_thread_root?: boolean | null;
          medias?: Json | null;
          metadata?: Json | null;
          origin_message_id?: string | null;
          reactions?: Json | null;
          replied_message_preview?: string | null;
          reply_to_message_id?: string | null;
          thread_depth?: number | null;
          thread_id?: string | null;
          thread_owner_user_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"] | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          content?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          html?: string | null;
          id?: string;
          is_thread_root?: boolean | null;
          medias?: Json | null;
          metadata?: Json | null;
          origin_message_id?: string | null;
          reactions?: Json | null;
          replied_message_preview?: string | null;
          reply_to_message_id?: string | null;
          thread_depth?: number | null;
          thread_id?: string | null;
          thread_owner_user_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "view_channels";
            referencedColumns: ["channel_id"];
          },
          {
            foreignKeyName: "messages_origin_message_id_fkey";
            columns: ["origin_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey";
            columns: ["reply_to_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_thread_owner_user_id_fkey";
            columns: ["thread_owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          action_url: string | null;
          channel_id: string | null;
          created_at: string;
          id: string;
          message_id: string | null;
          message_preview: string | null;
          read_at: string | null;
          receiver_user_id: string;
          sender_user_id: string | null;
          type: Database["public"]["Enums"]["notification_category"];
        };
        Insert: {
          action_url?: string | null;
          channel_id?: string | null;
          created_at?: string;
          id?: string;
          message_id?: string | null;
          message_preview?: string | null;
          read_at?: string | null;
          receiver_user_id: string;
          sender_user_id?: string | null;
          type: Database["public"]["Enums"]["notification_category"];
        };
        Update: {
          action_url?: string | null;
          channel_id?: string | null;
          created_at?: string;
          id?: string;
          message_id?: string | null;
          message_preview?: string | null;
          read_at?: string | null;
          receiver_user_id?: string;
          sender_user_id?: string | null;
          type?: Database["public"]["Enums"]["notification_category"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "view_channels";
            referencedColumns: ["channel_id"];
          },
          {
            foreignKeyName: "notifications_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_receiver_user_id_fkey";
            columns: ["receiver_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_sender_user_id_fkey";
            columns: ["sender_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pinned_messages: {
        Row: {
          channel_id: string;
          content: string;
          id: string;
          message_id: string;
          pinned_at: string;
          pinned_by: string;
        };
        Insert: {
          channel_id: string;
          content: string;
          id?: string;
          message_id: string;
          pinned_at?: string;
          pinned_by: string;
        };
        Update: {
          channel_id?: string;
          content?: string;
          id?: string;
          message_id?: string;
          pinned_at?: string;
          pinned_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pinned_messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pinned_messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "view_channels";
            referencedColumns: ["channel_id"];
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pinned_messages_pinned_by_fkey";
            columns: ["pinned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          description: string | null;
          display_name: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          last_seen_at: string | null;
          status: Database["public"]["Enums"]["user_status"] | null;
          updated_at: string;
          username: string;
          website: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          last_seen_at?: string | null;
          status?: Database["public"]["Enums"]["user_status"] | null;
          updated_at?: string;
          username: string;
          website?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          last_seen_at?: string | null;
          status?: Database["public"]["Enums"]["user_status"] | null;
          updated_at?: string;
          username?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          metadata: Json | null;
          name: string;
          slug: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          name: string;
          slug: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          name?: string;
          slug?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      view_channels: {
        Row: {
          allow_emoji_reactions: boolean | null;
          channel_id: string | null;
          channel_type: Database["public"]["Enums"]["channel_type"] | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          is_avatar_set: boolean | null;
          last_activity_at: string | null;
          last_message_preview: string | null;
          member_count: number | null;
          member_limit: number | null;
          metadata: Json | null;
          mute_in_app_notifications: boolean | null;
          name: string | null;
          slug: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      view_pinned_messages: {
        Row: {
          channel_id: string | null;
          content: string | null;
          html: string | null;
          medias: Json | null;
          message_created_at: string | null;
          message_type: Database["public"]["Enums"]["message_type"] | null;
          message_updated_at: string | null;
          message_user_id: string | null;
          metadata: Json | null;
          pinned_at: string | null;
          pinned_by: string | null;
          pinned_message_id: string | null;
          pinner_avatar_url: string | null;
          pinner_full_name: string | null;
          pinner_username: string | null;
          reactions: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["message_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pinned_messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pinned_messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "view_channels";
            referencedColumns: ["channel_id"];
          },
          {
            foreignKeyName: "pinned_messages_pinned_by_fkey";
            columns: ["pinned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      get_channel_aggregate_data: {
        Args: {
          input_channel_id: string;
          message_limit?: number;
        };
        Returns: {
          channel_info: Json;
          last_messages: Json;
          member_count: number;
          pinned_messages: Json;
          user_profile: Json;
          is_user_channel_member: boolean;
          channel_member_info: Json;
        }[];
      };
      get_channel_messages_paginated: {
        Args: {
          input_channel_id: string;
          page: number;
          page_size?: number;
        };
        Returns: {
          messages: Json;
        }[];
      };
      truncate_content: {
        Args: {
          input_content: string;
          max_length?: number;
        };
        Returns: string;
      };
    };
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
        | "roles.delete";
      app_role: "admin" | "moderator" | "member" | "guest";
      channel_member_role: "MEMBER" | "ADMIN" | "MODERATOR" | "GUEST";
      channel_type: "PUBLIC" | "PRIVATE" | "BROADCAST" | "ARCHIVE" | "DIRECT" | "GROUP";
      message_type: "text" | "image" | "video" | "audio" | "link" | "giphy" | "file";
      notification_category:
        | "mention"
        | "message"
        | "reply"
        | "reaction"
        | "thread_message"
        | "channel_event"
        | "direct_message"
        | "invitation"
        | "system_alert";
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
        | "performance_insight";
      user_status: "ONLINE" | "OFFLINE" | "AWAY" | "BUSY" | "INVISIBLE";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    ? (Database["public"]["Tables"] & Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof Database["public"]["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never;
