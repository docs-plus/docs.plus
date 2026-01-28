export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
          channel_member_role: Database['public']['Enums']['channel_member_role'] | null
          created_at: string
          id: string
          joined_at: string
          last_read_message_id: string | null
          last_read_update_at: string | null
          left_at: string | null
          member_id: string
          mute_in_app_notifications: boolean | null
          notif_state: Database['public']['Enums']['channel_notification_state'] | null
          unread_message_count: number | null
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          channel_member_role?: Database['public']['Enums']['channel_member_role'] | null
          created_at?: string
          id?: string
          joined_at?: string
          last_read_message_id?: string | null
          last_read_update_at?: string | null
          left_at?: string | null
          member_id: string
          mute_in_app_notifications?: boolean | null
          notif_state?: Database['public']['Enums']['channel_notification_state'] | null
          unread_message_count?: number | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          channel_member_role?: Database['public']['Enums']['channel_member_role'] | null
          created_at?: string
          id?: string
          joined_at?: string
          last_read_message_id?: string | null
          last_read_update_at?: string | null
          left_at?: string | null
          member_id?: string
          mute_in_app_notifications?: boolean | null
          notif_state?: Database['public']['Enums']['channel_notification_state'] | null
          unread_message_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'channel_members_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channel_members_last_read_message_id_fkey'
            columns: ['last_read_message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channel_members_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'channel_message_counts_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: true
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channel_message_counts_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
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
          type: Database['public']['Enums']['channel_type'] | null
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
          type?: Database['public']['Enums']['channel_type'] | null
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
          type?: Database['public']['Enums']['channel_type'] | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'channels_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'channels_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      message_bookmarks: {
        Row: {
          archived_at: string | null
          created_at: string
          id: number
          marked_at: string | null
          message_id: string
          metadata: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: never
          marked_at?: string | null
          message_id: string
          metadata?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: never
          marked_at?: string | null
          message_id?: string
          metadata?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'message_bookmarks_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_bookmarks_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
          type: Database['public']['Enums']['message_type'] | null
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
          type?: Database['public']['Enums']['message_type'] | null
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
          type?: Database['public']['Enums']['message_type'] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_origin_message_id_fkey'
            columns: ['origin_message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_reply_to_message_id_fkey'
            columns: ['reply_to_message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_thread_id_fkey'
            columns: ['thread_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_thread_owner_id_fkey'
            columns: ['thread_owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
          type: Database['public']['Enums']['notification_category']
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
          type: Database['public']['Enums']['notification_category']
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
          type?: Database['public']['Enums']['notification_category']
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_receiver_user_id_fkey'
            columns: ['receiver_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_sender_user_id_fkey'
            columns: ['sender_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'pinned_messages_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pinned_messages_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pinned_messages_pinned_by_fkey'
            columns: ['pinned_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
          status: Database['public']['Enums']['user_status']
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
          status?: Database['public']['Enums']['user_status']
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
          status?: Database['public']['Enums']['user_status']
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          member_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          member_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          member_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
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
            foreignKeyName: 'workspaces_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_bookmark: {
        Args: { p_bookmark_id: number; p_archive?: boolean }
        Returns: boolean
      }
      create_direct_message_channel: {
        Args: { workspace_uid: string; user_id: string }
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
        Args: { _workspace_id: string; _username: string }
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
      get_bookmark_count: {
        Args: { p_workspace_id?: string; p_archived?: boolean }
        Returns: number
      }
      get_bookmark_stats: {
        Args: { p_workspace_id?: string }
        Returns: Json
      }
      get_channel_aggregate_data: {
        Args: {
          input_channel_id: string
          message_limit?: number
          anchor_message_id?: string
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
          anchor_message_timestamp: string
        }[]
      }
      get_channel_members_by_last_read_update: {
        Args: { _channel_id: string; _timestamp: string }
        Returns: {
          id: string
          username: string
          full_name: string
          display_name: string
          avatar_url: string
          avatar_updated_at: string
          last_read_update_at: string
          channel_member_role: Database['public']['Enums']['channel_member_role']
          joined_at: string
        }[]
      }
      get_channel_messages_paginated: {
        Args: {
          input_channel_id: string
          limit_count?: number
          cursor_timestamp?: string
          direction?: string
        }
        Returns: {
          messages: Json
          pagination_cursors: Json
        }[]
      }
      get_channel_notif_state: {
        Args: { _channel_id: string }
        Returns: Database['public']['Enums']['channel_notification_state']
      }
      get_unread_notif_count: {
        Args: { _workspace_id?: string }
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
      get_user_bookmarks: {
        Args: {
          p_workspace_id?: string
          p_archived?: boolean
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          bookmark_id: number
          bookmark_created_at: string
          bookmark_updated_at: string
          bookmark_archived_at: string
          bookmark_marked_at: string
          bookmark_metadata: Json
          message_id: string
          message_content: string
          message_html: string
          message_created_at: string
          message_user_id: string
          message_channel_id: string
          message_type: Database['public']['Enums']['message_type']
          user_details: Json
          channel_name: string
          channel_slug: string
          workspace_id: string
          workspace_name: string
          workspace_slug: string
        }[]
      }
      get_workspace_notifications: {
        Args: {
          p_user_id: string
          p_workspace_id: string
          p_limit?: number
          p_offset?: number
          p_is_read?: boolean
        }
        Returns: Json[]
      }
      join_workspace: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      mark_bookmark_as_read: {
        Args: { p_bookmark_id: number; p_mark_as_read?: boolean }
        Returns: boolean
      }
      mark_messages_as_read: {
        Args: { p_channel_id: string; p_message_id: string }
        Returns: undefined
      }
      message_counter_batch_worker: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      notifications_summary: {
        Args: { _workspace_id?: string }
        Returns: Json
      }
      toggle_message_bookmark: {
        Args: { p_message_id: string }
        Returns: Json
      }
      truncate_content: {
        Args: { input_content: string; max_length?: number }
        Returns: string
      }
      user_details_json: {
        Args: { u: Database['public']['Tables']['users']['Row'] }
        Returns: Json
      }
    }
    Enums: {
      app_permission:
        | 'channels.create'
        | 'channels.delete'
        | 'channels.edit'
        | 'messages.create'
        | 'messages.delete'
        | 'messages.edit'
        | 'users.view'
        | 'users.edit'
        | 'users.delete'
        | 'roles.create'
        | 'roles.edit'
        | 'roles.delete'
      app_role: 'admin' | 'moderator' | 'member' | 'guest'
      channel_member_role: 'MEMBER' | 'ADMIN' | 'MODERATOR' | 'GUEST'
      channel_notification_state: 'MENTIONS' | 'ALL' | 'MUTED'
      channel_type: 'PUBLIC' | 'PRIVATE' | 'BROADCAST' | 'ARCHIVE' | 'DIRECT' | 'GROUP' | 'THREAD'
      message_type:
        | 'text'
        | 'image'
        | 'video'
        | 'audio'
        | 'link'
        | 'giphy'
        | 'file'
        | 'notification'
      notification_category:
        | 'mention'
        | 'message'
        | 'reply'
        | 'reaction'
        | 'thread_message'
        | 'channel_event'
        | 'direct_message'
        | 'invitation'
        | 'system_alert'
      notification_type:
        | 'message'
        | 'channel_invite'
        | 'mention'
        | 'reply'
        | 'thread_update'
        | 'channel_update'
        | 'member_join'
        | 'member_leave'
        | 'user_activity'
        | 'task_assignment'
        | 'event_reminder'
        | 'system_update'
        | 'security_alert'
        | 'like_reaction'
        | 'feedback_request'
        | 'performance_insight'
      user_status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'INVISIBLE' | 'TYPING'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {}
  },
  public: {
    Enums: {
      app_permission: [
        'channels.create',
        'channels.delete',
        'channels.edit',
        'messages.create',
        'messages.delete',
        'messages.edit',
        'users.view',
        'users.edit',
        'users.delete',
        'roles.create',
        'roles.edit',
        'roles.delete'
      ],
      app_role: ['admin', 'moderator', 'member', 'guest'],
      channel_member_role: ['MEMBER', 'ADMIN', 'MODERATOR', 'GUEST'],
      channel_notification_state: ['MENTIONS', 'ALL', 'MUTED'],
      channel_type: ['PUBLIC', 'PRIVATE', 'BROADCAST', 'ARCHIVE', 'DIRECT', 'GROUP', 'THREAD'],
      message_type: ['text', 'image', 'video', 'audio', 'link', 'giphy', 'file', 'notification'],
      notification_category: [
        'mention',
        'message',
        'reply',
        'reaction',
        'thread_message',
        'channel_event',
        'direct_message',
        'invitation',
        'system_alert'
      ],
      notification_type: [
        'message',
        'channel_invite',
        'mention',
        'reply',
        'thread_update',
        'channel_update',
        'member_join',
        'member_leave',
        'user_activity',
        'task_assignment',
        'event_reminder',
        'system_update',
        'security_alert',
        'like_reaction',
        'feedback_request',
        'performance_insight'
      ],
      user_status: ['ONLINE', 'OFFLINE', 'AWAY', 'BUSY', 'INVISIBLE', 'TYPING']
    }
  }
} as const
