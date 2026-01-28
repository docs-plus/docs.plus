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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'admin_users_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'admin_users_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
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
      document_view_stats: {
        Row: {
          anonymous_views: number
          authenticated_views: number
          avg_duration_ms: number
          bounce_count: number
          bounce_rate: number
          document_slug: string
          first_viewed_at: string | null
          guest_views: number
          last_viewed_at: string | null
          stats_updated_at: string | null
          total_duration_ms: number
          total_views: number
          unique_sessions: number
          unique_users: number
          unique_users_30d: number
          unique_users_7d: number
          views_30d: number
          views_7d: number
          views_desktop: number
          views_mobile: number
          views_tablet: number
          views_today: number
        }
        Insert: {
          anonymous_views?: number
          authenticated_views?: number
          avg_duration_ms?: number
          bounce_count?: number
          bounce_rate?: number
          document_slug: string
          first_viewed_at?: string | null
          guest_views?: number
          last_viewed_at?: string | null
          stats_updated_at?: string | null
          total_duration_ms?: number
          total_views?: number
          unique_sessions?: number
          unique_users?: number
          unique_users_30d?: number
          unique_users_7d?: number
          views_30d?: number
          views_7d?: number
          views_desktop?: number
          views_mobile?: number
          views_tablet?: number
          views_today?: number
        }
        Update: {
          anonymous_views?: number
          authenticated_views?: number
          avg_duration_ms?: number
          bounce_count?: number
          bounce_rate?: number
          document_slug?: string
          first_viewed_at?: string | null
          guest_views?: number
          last_viewed_at?: string | null
          stats_updated_at?: string | null
          total_duration_ms?: number
          total_views?: number
          unique_sessions?: number
          unique_users?: number
          unique_users_30d?: number
          unique_users_7d?: number
          views_30d?: number
          views_7d?: number
          views_desktop?: number
          views_mobile?: number
          views_tablet?: number
          views_today?: number
        }
        Relationships: []
      }
      document_views: {
        Row: {
          device_type: string | null
          document_slug: string
          duration_ms: number | null
          id: string
          is_anonymous: boolean
          is_authenticated: boolean
          is_bounce: boolean | null
          session_id: string
          user_id: string | null
          view_date: string
          viewed_at: string
        }
        Insert: {
          device_type?: string | null
          document_slug: string
          duration_ms?: number | null
          id: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Update: {
          device_type?: string | null
          document_slug?: string
          duration_ms?: number | null
          id?: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id?: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'document_views_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      document_views_2026_01: {
        Row: {
          device_type: string | null
          document_slug: string
          duration_ms: number | null
          id: string
          is_anonymous: boolean
          is_authenticated: boolean
          is_bounce: boolean | null
          session_id: string
          user_id: string | null
          view_date: string
          viewed_at: string
        }
        Insert: {
          device_type?: string | null
          document_slug: string
          duration_ms?: number | null
          id: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Update: {
          device_type?: string | null
          document_slug?: string
          duration_ms?: number | null
          id?: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id?: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Relationships: []
      }
      document_views_2026_02: {
        Row: {
          device_type: string | null
          document_slug: string
          duration_ms: number | null
          id: string
          is_anonymous: boolean
          is_authenticated: boolean
          is_bounce: boolean | null
          session_id: string
          user_id: string | null
          view_date: string
          viewed_at: string
        }
        Insert: {
          device_type?: string | null
          document_slug: string
          duration_ms?: number | null
          id: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Update: {
          device_type?: string | null
          document_slug?: string
          duration_ms?: number | null
          id?: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id?: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Relationships: []
      }
      document_views_2026_03: {
        Row: {
          device_type: string | null
          document_slug: string
          duration_ms: number | null
          id: string
          is_anonymous: boolean
          is_authenticated: boolean
          is_bounce: boolean | null
          session_id: string
          user_id: string | null
          view_date: string
          viewed_at: string
        }
        Insert: {
          device_type?: string | null
          document_slug: string
          duration_ms?: number | null
          id: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Update: {
          device_type?: string | null
          document_slug?: string
          duration_ms?: number | null
          id?: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id?: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Relationships: []
      }
      document_views_2026_04: {
        Row: {
          device_type: string | null
          document_slug: string
          duration_ms: number | null
          id: string
          is_anonymous: boolean
          is_authenticated: boolean
          is_bounce: boolean | null
          session_id: string
          user_id: string | null
          view_date: string
          viewed_at: string
        }
        Insert: {
          device_type?: string | null
          document_slug: string
          duration_ms?: number | null
          id: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Update: {
          device_type?: string | null
          document_slug?: string
          duration_ms?: number | null
          id?: string
          is_anonymous?: boolean
          is_authenticated?: boolean
          is_bounce?: boolean | null
          session_id?: string
          user_id?: string | null
          view_date?: string
          viewed_at?: string
        }
        Relationships: []
      }
      document_views_daily: {
        Row: {
          avg_duration_ms: number
          bounce_count: number
          document_slug: string
          unique_sessions: number
          unique_users: number
          view_date: string
          views: number
        }
        Insert: {
          avg_duration_ms?: number
          bounce_count?: number
          document_slug: string
          unique_sessions?: number
          unique_users?: number
          view_date: string
          views?: number
        }
        Update: {
          avg_duration_ms?: number
          bounce_count?: number
          document_slug?: string
          unique_sessions?: number
          unique_users?: number
          view_date?: string
          views?: number
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          notification_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'email_queue_notification_id_fkey'
            columns: ['notification_id']
            isOneToOne: false
            referencedRelation: 'notifications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'email_queue_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
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
      push_subscriptions: {
        Row: {
          created_at: string
          device_id: string
          device_name: string | null
          failed_count: number
          id: string
          is_active: boolean
          last_error: string | null
          last_used_at: string | null
          platform: string
          push_credentials: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name?: string | null
          failed_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          platform?: string
          push_credentials: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string | null
          failed_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          platform?: string
          push_credentials?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
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
          left_at: string | null
          member_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          left_at?: string | null
          member_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
      aggregate_document_view_stats: { Args: never; Returns: Json }
      archive_bookmark: {
        Args: { p_archive?: boolean; p_bookmark_id: number }
        Returns: boolean
      }
      cleanup_email_queue: { Args: never; Returns: undefined }
      cleanup_old_document_views: { Args: never; Returns: Json }
      cleanup_push_subscriptions: { Args: never; Returns: undefined }
      create_direct_message_channel: {
        Args: { user_id: string; workspace_uid: string }
        Returns: Json
      }
      create_document_views_partitions: { Args: never; Returns: undefined }
      create_thread_message: {
        Args: {
          p_content: string
          p_html: string
          p_thread_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      enqueue_document_view: {
        Args: {
          p_device_type?: string
          p_document_slug: string
          p_is_anonymous?: boolean
          p_session_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      fetch_mentioned_users: {
        Args: { _username: string; _workspace_id: string }
        Returns: {
          avatar_updated_at: string
          avatar_url: string
          created_at: string
          display_name: string
          full_name: string
          id: string
          username: string
        }[]
      }
      generate_unsubscribe_token: {
        Args: { p_action: string; p_user_id: string }
        Returns: string
      }
      get_activity_by_hour: {
        Args: { p_days?: number }
        Returns: {
          day_of_week: number
          hour_of_day: number
          message_count: number
        }[]
      }
      get_bookmark_count: {
        Args: { p_archived?: boolean; p_workspace_id?: string }
        Returns: number
      }
      get_bookmark_stats: { Args: { p_workspace_id?: string }; Returns: Json }
      get_channel_aggregate_data: {
        Args: {
          anchor_message_id?: string
          input_channel_id: string
          message_limit?: number
        }
        Returns: {
          anchor_message_timestamp: string
          channel_info: Json
          channel_member_info: Json
          is_user_channel_member: boolean
          last_messages: Json
          last_read_message_id: string
          last_read_message_timestamp: string
          pinned_messages: Json
          total_messages_since_last_read: number
          unread_message: boolean
        }[]
      }
      get_channel_members_by_last_read_update: {
        Args: { _channel_id: string; _timestamp: string }
        Returns: {
          avatar_updated_at: string
          avatar_url: string
          display_name: string
          full_name: string
          last_read_update_at: string
          user_id: string
          username: string
        }[]
      }
      get_channel_messages_paginated: {
        Args: {
          cursor_timestamp?: string
          direction?: string
          input_channel_id: string
          limit_count?: number
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
      get_communication_stats: { Args: { p_days?: number }; Returns: Json }
      get_dau_trend: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          activity_date: string
        }[]
      }
      get_document_view_stats: {
        Args: { p_document_slug: string }
        Returns: Json
      }
      get_document_views_summary: { Args: never; Returns: Json }
      get_document_views_trend: {
        Args: { p_days?: number; p_document_slug?: string }
        Returns: {
          unique_visitors: number
          view_date: string
          views: number
        }[]
      }
      get_email_footer_links: {
        Args: { p_base_url?: string; p_user_id: string }
        Returns: Json
      }
      get_email_notification_stats: { Args: never; Returns: Json }
      get_message_type_distribution: {
        Args: { p_days?: number }
        Returns: {
          count: number
          message_type: string
          percentage: number
        }[]
      }
      get_notification_reach: { Args: never; Returns: Json }
      get_push_notification_stats: { Args: never; Returns: Json }
      get_push_subscriptions: {
        Args: never
        Returns: {
          created_at: string
          device_id: string
          device_name: string
          id: string
          is_active: boolean
          platform: string
        }[]
      }
      get_retention_metrics: { Args: never; Returns: Json }
      get_top_active_documents: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          document_slug: string
          message_count: number
          unique_users: number
          workspace_id: string
        }[]
      }
      get_top_viewed_documents: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          avg_duration_ms: number
          bounce_rate: number
          document_slug: string
          unique_visitors: number
          views: number
        }[]
      }
      get_unread_notif_count: {
        Args: { _workspace_id?: string }
        Returns: number
      }
      get_unread_notifications_paginated: {
        Args: {
          _page?: number
          _page_size?: number
          _type?: string
          _workspace_id?: string
        }
        Returns: Json[]
      }
      get_unsubscribe_url: {
        Args: { p_action: string; p_base_url?: string; p_user_id: string }
        Returns: string
      }
      get_user_bookmarks: {
        Args: {
          p_archived?: boolean
          p_limit?: number
          p_offset?: number
          p_workspace_id?: string
        }
        Returns: {
          bookmark_archived_at: string
          bookmark_created_at: string
          bookmark_id: number
          bookmark_marked_at: string
          bookmark_metadata: Json
          bookmark_updated_at: string
          channel_name: string
          channel_slug: string
          message_channel_id: string
          message_content: string
          message_created_at: string
          message_html: string
          message_id: string
          message_type: Database['public']['Enums']['message_type']
          message_user_id: string
          user_details: Json
          workspace_id: string
          workspace_name: string
          workspace_slug: string
        }[]
      }
      get_user_lifecycle_segments: { Args: never; Returns: Json }
      get_workspace_notifications: {
        Args: {
          p_is_read?: boolean
          p_limit?: number
          p_offset?: number
          p_user_id: string
          p_workspace_id: string
        }
        Returns: Json[]
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      join_workspace: { Args: { _workspace_id: string }; Returns: boolean }
      mark_bookmark_as_read: {
        Args: { p_bookmark_id: number; p_mark_as_read?: boolean }
        Returns: boolean
      }
      mark_messages_as_read: {
        Args: { p_channel_id: string; p_message_id: string }
        Returns: undefined
      }
      message_counter_batch_worker: { Args: never; Returns: undefined }
      notifications_summary: { Args: { _workspace_id?: string }; Returns: Json }
      process_document_views_queue: { Args: never; Returns: Json }
      process_email_queue: { Args: never; Returns: Json }
      process_unsubscribe: { Args: { p_token: string }; Returns: Json }
      register_push_subscription: {
        Args: {
          p_device_id: string
          p_device_name: string
          p_platform: string
          p_push_credentials: Json
        }
        Returns: string
      }
      toggle_message_bookmark: { Args: { p_message_id: string }; Returns: Json }
      truncate_content: {
        Args: { input_content: string; max_length?: number }
        Returns: string
      }
      unregister_push_subscription: {
        Args: { p_device_id: string }
        Returns: boolean
      }
      update_view_duration: {
        Args: { p_duration_ms: number; p_view_id: string }
        Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
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
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
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
