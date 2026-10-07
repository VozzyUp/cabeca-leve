
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"currency": string,"id": string,"institution": string | null,"kind": string,"name": string,"opening_balance_cents": number,"opening_balance_on": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"institution"?: string | null,"kind"?: string,"name": string,"opening_balance_cents"?: number,"opening_balance_on"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"institution"?: string | null,"kind"?: string,"name"?: string,"opening_balance_cents"?: number,"opening_balance_on"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"actions": {
                  Row: {
                    "after": Json | null,"before": Json | null,"created_at": string,"entity_id": string,"entity_table": string,"id": string,"message_id": string | null,"operation": string,"tool_name": string,"undone_at": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id": string,"entity_table": string,"id"?: string,"message_id"?: string | null,"operation": string,"tool_name": string,"undone_at"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string,"entity_table"?: string,"id"?: string,"message_id"?: string | null,"operation"?: string,"tool_name"?: string,"undone_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "actions_message_id_user_id_fkey"
      columns: ["message_id","user_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"alert_events": {
                  Row: {
                    "created_at": string,"dedupe_key": string,"fired_at": string,"id": string,"payload": NonNullable<Json>,"rule_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dedupe_key": string,"fired_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"rule_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string,"fired_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"rule_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_events_rule_id_user_id_fkey"
      columns: ["rule_id","user_id"]
isOneToOne: false
      referencedRelation: "alert_rules"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"alert_rules": {
                  Row: {
                    "channels": (string)[],"created_at": string,"enabled": boolean,"id": string,"kind": string,"threshold": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channels"?: (string)[],"created_at"?: string,"enabled"?: boolean,"id"?: string,"kind": string,"threshold"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "channels"?: (string)[],"created_at"?: string,"enabled"?: boolean,"id"?: string,"kind"?: string,"threshold"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"attachments": {
                  Row: {
                    "created_at": string,"duration_ms": number | null,"error": string | null,"id": string,"kind": string,"message_id": string | null,"mime_type": string,"size_bytes": number,"status": string,"storage_path": string,"transcript": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_ms"?: number | null,"error"?: string | null,"id"?: string,"kind": string,"message_id"?: string | null,"mime_type": string,"size_bytes": number,"status"?: string,"storage_path": string,"transcript"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"duration_ms"?: number | null,"error"?: string | null,"id"?: string,"kind"?: string,"message_id"?: string | null,"mime_type"?: string,"size_bytes"?: number,"status"?: string,"storage_path"?: string,"transcript"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_message_id_user_id_fkey"
      columns: ["message_id","user_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"automation_runs": {
                  Row: {
                    "automation_id": string,"created_at": string,"error": string | null,"finished_at": string | null,"id": string,"message_id": string | null,"read_at": string | null,"scheduled_for": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "automation_id": string,"created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"message_id"?: string | null,"read_at"?: string | null,"scheduled_for": string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "automation_id"?: string,"created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"message_id"?: string | null,"read_at"?: string | null,"scheduled_for"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_runs_automation_id_user_id_fkey"
      columns: ["automation_id","user_id"]
isOneToOne: false
      referencedRelation: "automations"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "automation_runs_message_id_user_id_fkey"
      columns: ["message_id","user_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"automations": {
                  Row: {
                    "active": boolean,"channel": string,"created_at": string,"id": string,"instruction": string,"lookback_days": number,"next_run_at": string | null,"push": boolean,"run_on": string | null,"run_time": string,"schedule": string,"sources": (string)[],"timezone": string,"title": string,"updated_at": string,"user_id": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"channel"?: string,"created_at"?: string,"id"?: string,"instruction": string,"lookback_days"?: number,"next_run_at"?: string | null,"push"?: boolean,"run_on"?: string | null,"run_time": string,"schedule": string,"sources": (string)[],"timezone": string,"title": string,"updated_at"?: string,"user_id": string,"weekdays"?: (number)[]
                  }
                  Update: {
                    "active"?: boolean,"channel"?: string,"created_at"?: string,"id"?: string,"instruction"?: string,"lookback_days"?: number,"next_run_at"?: string | null,"push"?: boolean,"run_on"?: string | null,"run_time"?: string,"schedule"?: string,"sources"?: (string)[],"timezone"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"billing_events": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"type": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"type": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"type"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"body_measurements": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"measured_at": string,"source": string,"unit": string,"updated_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"measured_at": string,"source"?: string,"unit": string,"updated_at"?: string,"user_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"measured_at"?: string,"source"?: string,"unit"?: string,"updated_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"budgets": {
                  Row: {
                    "amount_cents": number,"category_id": string,"created_at": string,"currency": string,"id": string,"period": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"category_id": string,"created_at"?: string,"currency"?: string,"id"?: string,"period"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"category_id"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"period"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_category_id_user_id_fkey"
      columns: ["category_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"calendar_events": {
                  Row: {
                    "all_day": boolean,"attendees": NonNullable<Json>,"calendar_id": string,"created_at": string,"ends_at": string,"etag": string | null,"external_id": string,"id": string,"location": string | null,"starts_at": string,"status": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"attendees"?: NonNullable<Json>,"calendar_id": string,"created_at"?: string,"ends_at": string,"etag"?: string | null,"external_id": string,"id"?: string,"location"?: string | null,"starts_at": string,"status"?: string,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "all_day"?: boolean,"attendees"?: NonNullable<Json>,"calendar_id"?: string,"created_at"?: string,"ends_at"?: string,"etag"?: string | null,"external_id"?: string,"id"?: string,"location"?: string | null,"starts_at"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_calendar_id_user_id_fkey"
      columns: ["calendar_id","user_id"]
isOneToOne: false
      referencedRelation: "calendars"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"calendars": {
                  Row: {
                    "color": string | null,"created_at": string,"external_id": string,"id": string,"integration_id": string,"name": string,"selected": boolean,"sync_token": string | null,"updated_at": string,"user_id": string,"watch_channel_id": string | null,"watch_expires_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"external_id": string,"id"?: string,"integration_id": string,"name": string,"selected"?: boolean,"sync_token"?: string | null,"updated_at"?: string,"user_id": string,"watch_channel_id"?: string | null,"watch_expires_at"?: string | null
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"external_id"?: string,"id"?: string,"integration_id"?: string,"name"?: string,"selected"?: boolean,"sync_token"?: string | null,"updated_at"?: string,"user_id"?: string,"watch_channel_id"?: string | null,"watch_expires_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendars_integration_id_user_id_fkey"
      columns: ["integration_id","user_id"]
isOneToOne: false
      referencedRelation: "integrations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"card_invoices": {
                  Row: {
                    "card_id": string,"closes_on": string,"created_at": string,"due_on": string,"id": string,"paid_at": string | null,"reference_month": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"closes_on": string,"created_at"?: string,"due_on": string,"id"?: string,"paid_at"?: string | null,"reference_month": string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "card_id"?: string,"closes_on"?: string,"created_at"?: string,"due_on"?: string,"id"?: string,"paid_at"?: string | null,"reference_month"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_invoices_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "archived_at": string | null,"closing_day": number,"created_at": string,"currency": string,"due_day": number,"id": string,"institution": string | null,"limit_cents": number,"name": string,"payment_account_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"closing_day": number,"created_at"?: string,"currency"?: string,"due_day": number,"id"?: string,"institution"?: string | null,"limit_cents": number,"name": string,"payment_account_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"closing_day"?: number,"created_at"?: string,"currency"?: string,"due_day"?: number,"id"?: string,"institution"?: string | null,"limit_cents"?: number,"name"?: string,"payment_account_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_payment_account_id_user_id_fkey"
      columns: ["payment_account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "cards_payment_account_id_user_id_fkey"
      columns: ["payment_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"color": string | null,"created_at": string,"icon": string | null,"id": string,"kind": string,"name": string,"parent_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"icon"?: string | null,"id"?: string,"kind": string,"name": string,"parent_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"icon"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"parent_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_user_id_fkey"
      columns: ["parent_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"channel_links": {
                  Row: {
                    "channel": string,"created_at": string,"external_id": string,"id": string,"last_inbound_at": string | null,"updated_at": string,"user_id": string,"verification_code_hash": string | null,"verification_expires_at": string | null,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"created_at"?: string,"external_id": string,"id"?: string,"last_inbound_at"?: string | null,"updated_at"?: string,"user_id": string,"verification_code_hash"?: string | null,"verification_expires_at"?: string | null,"verified_at"?: string | null
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"external_id"?: string,"id"?: string,"last_inbound_at"?: string | null,"updated_at"?: string,"user_id"?: string,"verification_code_hash"?: string | null,"verification_expires_at"?: string | null,"verified_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"conversations": {
                  Row: {
                    "compacted_at": string | null,"created_at": string,"id": string,"local_date": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "compacted_at"?: string | null,"created_at"?: string,"id"?: string,"local_date": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "compacted_at"?: string | null,"created_at"?: string,"id"?: string,"local_date"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"diet_meals": {
                  Row: {
                    "at_time": string | null,"created_at": string,"diet_plan_id": string,"id": string,"items": string,"kcal": number | null,"name": string,"position": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at_time"?: string | null,"created_at"?: string,"diet_plan_id": string,"id"?: string,"items"?: string,"kcal"?: number | null,"name": string,"position"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "at_time"?: string | null,"created_at"?: string,"diet_plan_id"?: string,"id"?: string,"items"?: string,"kcal"?: number | null,"name"?: string,"position"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "diet_meals_diet_plan_id_user_id_fkey"
      columns: ["diet_plan_id","user_id"]
isOneToOne: false
      referencedRelation: "diet_plans"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"diet_plans": {
                  Row: {
                    "active": boolean,"carbs_g": number | null,"created_at": string,"fat_g": number | null,"id": string,"kcal_rest": number | null,"kcal_training": number | null,"name": string,"protein_g": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"id"?: string,"kcal_rest"?: number | null,"kcal_training"?: number | null,"name": string,"protein_g"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"id"?: string,"kcal_rest"?: number | null,"kcal_training"?: number | null,"name"?: string,"protein_g"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"embeddings": {
                  Row: {
                    "chunk_index": number,"content": string,"created_at": string,"embedding": string,"id": string,"model": string,"source_id": string,"source_type": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chunk_index"?: number,"content": string,"created_at"?: string,"embedding": string,"id"?: string,"model": string,"source_id": string,"source_type": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "chunk_index"?: number,"content"?: string,"created_at"?: string,"embedding"?: string,"id"?: string,"model"?: string,"source_id"?: string,"source_type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"focus_sessions": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"planned_minutes": number | null,"started_at": string,"task_id": string | null,"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"planned_minutes"?: number | null,"started_at": string,"task_id"?: string | null,"title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"planned_minutes"?: number | null,"started_at"?: string,"task_id"?: string | null,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "focus_sessions_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"food_logs": {
                  Row: {
                    "carbs_g": number | null,"created_at": string,"fat_g": number | null,"id": string,"items": string,"kcal": number | null,"logged_on": string,"meal_name": string | null,"protein_g": number | null,"source": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"id"?: string,"items": string,"kcal"?: number | null,"logged_on": string,"meal_name"?: string | null,"protein_g"?: number | null,"source"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "carbs_g"?: number | null,"created_at"?: string,"fat_g"?: number | null,"id"?: string,"items"?: string,"kcal"?: number | null,"logged_on"?: string,"meal_name"?: string | null,"protein_g"?: number | null,"source"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"goal_entries": {
                  Row: {
                    "created_at": string,"goal_id": string,"id": string,"note": string | null,"occurred_on": string,"updated_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"goal_id": string,"id"?: string,"note"?: string | null,"occurred_on"?: string,"updated_at"?: string,"user_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"goal_id"?: string,"id"?: string,"note"?: string | null,"occurred_on"?: string,"updated_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_entries_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "account_id": string | null,"created_at": string,"deadline": string | null,"habit_id": string | null,"id": string,"kind": string,"monthly_plan": number | null,"project_id": string | null,"starts_on": string,"status": string,"target_value": number,"title": string,"unit": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"created_at"?: string,"deadline"?: string | null,"habit_id"?: string | null,"id"?: string,"kind": string,"monthly_plan"?: number | null,"project_id"?: string | null,"starts_on"?: string,"status"?: string,"target_value": number,"title": string,"unit"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"created_at"?: string,"deadline"?: string | null,"habit_id"?: string | null,"id"?: string,"kind"?: string,"monthly_plan"?: number | null,"project_id"?: string | null,"starts_on"?: string,"status"?: string,"target_value"?: number,"title"?: string,"unit"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "goals_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "goals_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "goals_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"habit_logs": {
                  Row: {
                    "created_at": string,"day": string,"habit_id": string,"id": string,"off_plan": boolean,"source": string,"updated_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"habit_id": string,"id"?: string,"off_plan"?: boolean,"source"?: string,"updated_at"?: string,"user_id": string,"value"?: number
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"habit_id"?: string,"id"?: string,"off_plan"?: boolean,"source"?: string,"updated_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_logs_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "active": boolean,"archived_at": string | null,"color": string | null,"created_at": string,"goal_target": number | null,"goal_type": string,"goal_unit": string | null,"id": string,"name": string,"overdue_nudge": boolean,"times": (string)[],"updated_at": string,"user_id": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"goal_target"?: number | null,"goal_type"?: string,"goal_unit"?: string | null,"id"?: string,"name": string,"overdue_nudge"?: boolean,"times"?: (string)[],"updated_at"?: string,"user_id": string,"weekdays"?: (number)[]
                  }
                  Update: {
                    "active"?: boolean,"archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"goal_target"?: number | null,"goal_type"?: string,"goal_unit"?: string | null,"id"?: string,"name"?: string,"overdue_nudge"?: boolean,"times"?: (string)[],"updated_at"?: string,"user_id"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"health_samples": {
                  Row: {
                    "created_at": string,"ends_at": string,"external_id": string,"id": string,"kind": string,"source": string,"starts_at": string,"unit": string,"updated_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at": string,"external_id": string,"id"?: string,"kind": string,"source": string,"starts_at": string,"unit": string,"updated_at"?: string,"user_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"external_id"?: string,"id"?: string,"kind"?: string,"source"?: string,"starts_at"?: string,"unit"?: string,"updated_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"installment_purchases": {
                  Row: {
                    "account_id": string | null,"card_id": string | null,"category_id": string | null,"created_at": string,"currency": string,"description": string,"first_due_on": string,"id": string,"installments_count": number,"total_cents": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"card_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"description": string,"first_due_on": string,"id"?: string,"installments_count": number,"total_cents": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"card_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"first_due_on"?: string,"id"?: string,"installments_count"?: number,"total_cents"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installment_purchases_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "installment_purchases_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "installment_purchases_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "installment_purchases_category_id_user_id_fkey"
      columns: ["category_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"integration_secrets": {
                  Row: {
                    "access_token_enc": string,"created_at": string,"expires_at": string | null,"integration_id": string,"refresh_token_enc": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_enc": string,"created_at"?: string,"expires_at"?: string | null,"integration_id": string,"refresh_token_enc"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "access_token_enc"?: string,"created_at"?: string,"expires_at"?: string | null,"integration_id"?: string,"refresh_token_enc"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_secrets_integration_id_user_id_fkey"
      columns: ["integration_id","user_id"]
isOneToOne: false
      referencedRelation: "integrations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "account_email": string | null,"created_at": string,"error": string | null,"id": string,"last_synced_at": string | null,"provider": string,"scopes": (string)[],"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_email"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"last_synced_at"?: string | null,"provider": string,"scopes"?: (string)[],"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_email"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"last_synced_at"?: string | null,"provider"?: string,"scopes"?: (string)[],"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"journal_entries": {
                  Row: {
                    "content": string,"created_at": string,"entry_on": string,"id": string,"search": unknown,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"entry_on": string,"id"?: string,"search"?: never,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"entry_on"?: string,"id"?: string,"search"?: never,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memories": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"fact": string,"id": string,"source_message_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"fact": string,"id"?: string,"source_message_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"fact"?: string,"id"?: string,"source_message_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_source_message_id_user_id_fkey"
      columns: ["source_message_id","user_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "cache_read_tokens": number | null,"cards": NonNullable<Json>,"channel": string,"client_message_id": string | null,"content": NonNullable<Json>,"conversation_id": string,"created_at": string,"external_message_id": string | null,"id": string,"input_tokens": number | null,"model": string | null,"output_tokens": number | null,"role": string,"seq": number,"text_preview": string | null,"updated_at": string,"user_id": string,"visible": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_read_tokens"?: number | null,"cards"?: NonNullable<Json>,"channel": string,"client_message_id"?: string | null,"content": NonNullable<Json>,"conversation_id": string,"created_at"?: string,"external_message_id"?: string | null,"id"?: string,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"role": string,"seq": number,"text_preview"?: string | null,"updated_at"?: string,"user_id": string,"visible"?: boolean
                  }
                  Update: {
                    "cache_read_tokens"?: number | null,"cards"?: NonNullable<Json>,"channel"?: string,"client_message_id"?: string | null,"content"?: NonNullable<Json>,"conversation_id"?: string,"created_at"?: string,"external_message_id"?: string | null,"id"?: string,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"role"?: string,"seq"?: number,"text_preview"?: string | null,"updated_at"?: string,"user_id"?: string,"visible"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_user_id_fkey"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "created_at": string,"done_at": string | null,"due_on": string | null,"id": string,"position": number,"project_id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done_at"?: string | null,"due_on"?: string | null,"id"?: string,"position"?: number,"project_id": string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"done_at"?: string | null,"due_on"?: string | null,"id"?: string,"position"?: number,"project_id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"note_links": {
                  Row: {
                    "created_at": string,"from_note_id": string,"id": string,"to_note_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_note_id": string,"id"?: string,"to_note_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"from_note_id"?: string,"id"?: string,"to_note_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_links_from_note_id_user_id_fkey"
      columns: ["from_note_id","user_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "note_links_to_note_id_user_id_fkey"
      columns: ["to_note_id","user_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notebooks": {
                  Row: {
                    "archived_at": string | null,"color": string | null,"created_at": string,"id": string,"name": string,"parent_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"id"?: string,"name": string,"parent_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"parent_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notebooks_parent_id_user_id_fkey"
      columns: ["parent_id","user_id"]
isOneToOne: false
      referencedRelation: "notebooks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "archived_at": string | null,"content": string,"created_at": string,"id": string,"in_inbox": boolean,"notebook_id": string | null,"pinned": boolean,"search": unknown,"source": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"in_inbox"?: boolean,"notebook_id"?: string | null,"pinned"?: boolean,"search"?: never,"source"?: string,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"in_inbox"?: boolean,"notebook_id"?: string | null,"pinned"?: boolean,"search"?: never,"source"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_notebook_id_user_id_fkey"
      columns: ["notebook_id","user_id"]
isOneToOne: false
      referencedRelation: "notebooks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "body": string,"created_at": string,"href": string | null,"id": string,"kind": string,"read_at": string | null,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"href"?: string | null,"id"?: string,"kind": string,"read_at"?: string | null,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"href"?: string | null,"id"?: string,"kind"?: string,"read_at"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "answer_length": string,"assistant_tone": string,"assistant_tone_custom": string | null,"assistant_voice": string | null,"briefing_enabled": boolean,"briefing_time": string,"created_at": string,"daily_alert_cap": number,"display_name": string | null,"locale": string,"memory_enabled": boolean,"notify_email": boolean,"notify_push": boolean,"notify_telegram": boolean,"quiet_hours_end": string | null,"quiet_hours_start": string | null,"theme": string,"timezone": string,"trial_ends_on": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_length"?: string,"assistant_tone"?: string,"assistant_tone_custom"?: string | null,"assistant_voice"?: string | null,"briefing_enabled"?: boolean,"briefing_time"?: string,"created_at"?: string,"daily_alert_cap"?: number,"display_name"?: string | null,"locale"?: string,"memory_enabled"?: boolean,"notify_email"?: boolean,"notify_push"?: boolean,"notify_telegram"?: boolean,"quiet_hours_end"?: string | null,"quiet_hours_start"?: string | null,"theme"?: string,"timezone"?: string,"trial_ends_on"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "answer_length"?: string,"assistant_tone"?: string,"assistant_tone_custom"?: string | null,"assistant_voice"?: string | null,"briefing_enabled"?: boolean,"briefing_time"?: string,"created_at"?: string,"daily_alert_cap"?: number,"display_name"?: string | null,"locale"?: string,"memory_enabled"?: boolean,"notify_email"?: boolean,"notify_push"?: boolean,"notify_telegram"?: boolean,"quiet_hours_end"?: string | null,"quiet_hours_start"?: string | null,"theme"?: string,"timezone"?: string,"trial_ends_on"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_templates": {
                  Row: {
                    "created_at": string,"definition": NonNullable<Json>,"id": string,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"definition"?: NonNullable<Json>,"id"?: string,"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"definition"?: NonNullable<Json>,"id"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "budget_cents": number | null,"created_at": string,"currency": string,"description": string | null,"due_on": string | null,"id": string,"name": string,"starts_on": string | null,"status": string,"template_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_cents"?: number | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"due_on"?: string | null,"id"?: string,"name": string,"starts_on"?: string | null,"status"?: string,"template_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "budget_cents"?: number | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"due_on"?: string | null,"id"?: string,"name"?: string,"starts_on"?: string | null,"status"?: string,"template_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_template_id_user_id_fkey"
      columns: ["template_id","user_id"]
isOneToOne: false
      referencedRelation: "project_templates"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_seen_at": string | null,"p256dh": string,"updated_at": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_seen_at"?: string | null,"p256dh": string,"updated_at"?: string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_seen_at"?: string | null,"p256dh"?: string,"updated_at"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recurrences": {
                  Row: {
                    "account_id": string | null,"amount_cents": number,"anchor_on": string,"card_id": string | null,"category_id": string | null,"created_at": string,"currency": string,"description": string,"ends_on": string | null,"frequency": string,"id": string,"interval_count": number,"kind": string,"paused": boolean,"payment_method": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount_cents": number,"anchor_on": string,"card_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"description": string,"ends_on"?: string | null,"frequency": string,"id"?: string,"interval_count"?: number,"kind": string,"paused"?: boolean,"payment_method"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"amount_cents"?: number,"anchor_on"?: string,"card_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"ends_on"?: string | null,"frequency"?: string,"id"?: string,"interval_count"?: number,"kind"?: string,"paused"?: boolean,"payment_method"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurrences_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "recurrences_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "recurrences_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "recurrences_category_id_user_id_fkey"
      columns: ["category_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "channels": (string)[],"created_at": string,"id": string,"important": boolean,"last_fired_at": string | null,"lead_minutes": (number)[],"next_fire_at": string | null,"notes": string | null,"recurrence_rule": string | null,"status": string,"task_id": string | null,"timezone": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channels"?: (string)[],"created_at"?: string,"id"?: string,"important"?: boolean,"last_fired_at"?: string | null,"lead_minutes"?: (number)[],"next_fire_at"?: string | null,"notes"?: string | null,"recurrence_rule"?: string | null,"status"?: string,"task_id"?: string | null,"timezone": string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "channels"?: (string)[],"created_at"?: string,"id"?: string,"important"?: boolean,"last_fired_at"?: string | null,"lead_minutes"?: (number)[],"next_fire_at"?: string | null,"notes"?: string | null,"recurrence_rule"?: string | null,"status"?: string,"task_id"?: string | null,"timezone"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"scheduled_deliveries": {
                  Row: {
                    "attempts": number,"channel": string,"created_at": string,"dedupe_key": string,"error": string | null,"id": string,"payload": NonNullable<Json>,"queue_message_id": string | null,"send_at": string,"sent_at": string | null,"source_id": string | null,"source_type": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": string,"created_at"?: string,"dedupe_key": string,"error"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"queue_message_id"?: string | null,"send_at": string,"sent_at"?: string | null,"source_id"?: string | null,"source_type": string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"dedupe_key"?: string,"error"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"queue_message_id"?: string | null,"send_at"?: string,"sent_at"?: string | null,"source_id"?: string | null,"source_type"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"statement_imports": {
                  Row: {
                    "account_id": string | null,"attachment_id": string,"card_id": string | null,"confirmed_at": string | null,"created_at": string,"error": string | null,"id": string,"items": NonNullable<Json>,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"attachment_id": string,"card_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"items"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"attachment_id"?: string,"card_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"items"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "statement_imports_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "statement_imports_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "statement_imports_attachment_id_user_id_fkey"
      columns: ["attachment_id","user_id"]
isOneToOne: false
      referencedRelation: "attachments"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "statement_imports_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"checkout_email": string | null,"created_at": string,"current_period_end": string | null,"id": string,"plan": string,"provider": string,"provider_customer_id": string,"provider_subscription_id": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"checkout_email"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan": string,"provider"?: string,"provider_customer_id": string,"provider_subscription_id": string,"status": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"checkout_email"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan"?: string,"provider"?: string,"provider_customer_id"?: string,"provider_subscription_id"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tasks": {
                  Row: {
                    "archived_at": string | null,"completed_at": string | null,"created_at": string,"due_at": string | null,"due_on": string | null,"id": string,"milestone_id": string | null,"notes": string | null,"parent_task_id": string | null,"position": number,"priority": string,"project_id": string | null,"recurrence_rule": string | null,"recurrence_source_id": string | null,"status": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_at"?: string | null,"due_on"?: string | null,"id"?: string,"milestone_id"?: string | null,"notes"?: string | null,"parent_task_id"?: string | null,"position"?: number,"priority"?: string,"project_id"?: string | null,"recurrence_rule"?: string | null,"recurrence_source_id"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_at"?: string | null,"due_on"?: string | null,"id"?: string,"milestone_id"?: string | null,"notes"?: string | null,"parent_task_id"?: string | null,"position"?: number,"priority"?: string,"project_id"?: string | null,"recurrence_rule"?: string | null,"recurrence_source_id"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_milestone_id_user_id_fkey"
      columns: ["milestone_id","user_id"]
isOneToOne: false
      referencedRelation: "milestones"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "tasks_parent_task_id_user_id_fkey"
      columns: ["parent_task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "tasks_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "tasks_recurrence_source_id_user_id_fkey"
      columns: ["recurrence_source_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string | null,"amount_cents": number,"card_id": string | null,"category_id": string | null,"counterpart_account_id": string | null,"created_at": string,"currency": string,"description": string,"id": string,"installment_number": number | null,"installment_purchase_id": string | null,"invoice_id": string | null,"merchant": string | null,"notes": string | null,"occurred_on": string,"payment_method": string | null,"project_id": string | null,"recurrence_id": string | null,"source": string,"status": string,"type": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount_cents": number,"card_id"?: string | null,"category_id"?: string | null,"counterpart_account_id"?: string | null,"created_at"?: string,"currency"?: string,"description": string,"id"?: string,"installment_number"?: number | null,"installment_purchase_id"?: string | null,"invoice_id"?: string | null,"merchant"?: string | null,"notes"?: string | null,"occurred_on": string,"payment_method"?: string | null,"project_id"?: string | null,"recurrence_id"?: string | null,"source"?: string,"status"?: string,"type": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"amount_cents"?: number,"card_id"?: string | null,"category_id"?: string | null,"counterpart_account_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"id"?: string,"installment_number"?: number | null,"installment_purchase_id"?: string | null,"invoice_id"?: string | null,"merchant"?: string | null,"notes"?: string | null,"occurred_on"?: string,"payment_method"?: string | null,"project_id"?: string | null,"recurrence_id"?: string | null,"source"?: string,"status"?: string,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "transactions_account_id_user_id_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_category_id_user_id_fkey"
      columns: ["category_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_counterpart_account_id_user_id_fkey"
      columns: ["counterpart_account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "transactions_counterpart_account_id_user_id_fkey"
      columns: ["counterpart_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_installment_purchase_id_user_id_fkey"
      columns: ["installment_purchase_id","user_id"]
isOneToOne: false
      referencedRelation: "installment_purchases"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_invoice_id_user_id_fkey"
      columns: ["invoice_id","user_id"]
isOneToOne: false
      referencedRelation: "card_invoice_totals"
      referencedColumns: ["invoice_id","user_id"]
    },{
      foreignKeyName: "transactions_invoice_id_user_id_fkey"
      columns: ["invoice_id","user_id"]
isOneToOne: false
      referencedRelation: "card_invoices"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_recurrence_id_user_id_fkey"
      columns: ["recurrence_id","user_id"]
isOneToOne: false
      referencedRelation: "recurrences"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"workout_logs": {
                  Row: {
                    "calories": number | null,"created_at": string,"distance_m": number | null,"duration_s": number | null,"external_id": string | null,"finished_at": string | null,"habit_id": string | null,"id": string,"kind": string,"plan_session_id": string | null,"source": string,"started_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calories"?: number | null,"created_at"?: string,"distance_m"?: number | null,"duration_s"?: number | null,"external_id"?: string | null,"finished_at"?: string | null,"habit_id"?: string | null,"id"?: string,"kind"?: string,"plan_session_id"?: string | null,"source"?: string,"started_at": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "calories"?: number | null,"created_at"?: string,"distance_m"?: number | null,"duration_s"?: number | null,"external_id"?: string | null,"finished_at"?: string | null,"habit_id"?: string | null,"id"?: string,"kind"?: string,"plan_session_id"?: string | null,"source"?: string,"started_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_logs_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "workout_logs_plan_session_id_user_id_fkey"
      columns: ["plan_session_id","user_id"]
isOneToOne: false
      referencedRelation: "workout_plan_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"workout_plan_exercises": {
                  Row: {
                    "created_at": string,"exercise_name": string,"id": string,"plan_session_id": string,"position": number,"rest_seconds": number | null,"target_load_kg": number | null,"target_reps": number | null,"target_sets": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_name": string,"id"?: string,"plan_session_id": string,"position"?: number,"rest_seconds"?: number | null,"target_load_kg"?: number | null,"target_reps"?: number | null,"target_sets"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"exercise_name"?: string,"id"?: string,"plan_session_id"?: string,"position"?: number,"rest_seconds"?: number | null,"target_load_kg"?: number | null,"target_reps"?: number | null,"target_sets"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_plan_exercises_plan_session_id_user_id_fkey"
      columns: ["plan_session_id","user_id"]
isOneToOne: false
      referencedRelation: "workout_plan_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"workout_plan_sessions": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"notes": string | null,"plan_id": string,"position": number,"updated_at": string,"user_id": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"plan_id": string,"position"?: number,"updated_at"?: string,"user_id": string,"weekdays"?: (number)[]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"plan_id"?: string,"position"?: number,"updated_at"?: string,"user_id"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_plan_sessions_plan_id_user_id_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "workout_plans"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"workout_plans": {
                  Row: {
                    "active": boolean,"created_at": string,"habit_id": string | null,"id": string,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"habit_id"?: string | null,"id"?: string,"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"habit_id"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_plans_habit_id_user_id_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"workout_sets": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"exercise_name": string,"id": string,"load_kg": number | null,"reps": number | null,"set_number": number,"updated_at": string,"user_id": string,"workout_log_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"exercise_name": string,"id"?: string,"load_kg"?: number | null,"reps"?: number | null,"set_number": number,"updated_at"?: string,"user_id": string,"workout_log_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"exercise_name"?: string,"id"?: string,"load_kg"?: number | null,"reps"?: number | null,"set_number"?: number,"updated_at"?: string,"user_id"?: string,"workout_log_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sets_workout_log_id_user_id_fkey"
      columns: ["workout_log_id","user_id"]
isOneToOne: false
      referencedRelation: "workout_logs"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            "account_balances": {
                  Row: {
                    "account_id": string | null,"balance_cents": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"card_invoice_totals": {
                  Row: {
                    "card_id": string | null,"invoice_id": string | null,"total_cents": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "card_invoices_card_id_user_id_fkey"
      columns: ["card_id","user_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Functions: {
            "unaccent":
{ Args: { "": string }; Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
