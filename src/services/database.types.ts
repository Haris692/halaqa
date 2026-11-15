
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "annotations": {
                  Row: {
                    "anchor": Json | null,"author_id": string,"author_role": Database["public"]['Enums']["author_role"],"created_at": string,"id": string,"kind": Database["public"]['Enums']["annotation_kind"],"points": (number)[] | null,"room_id": string,"session_id": string,"student_ids": (string)[],"style": NonNullable<Json>,"words": (string)[] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor"?: Json | null,"author_id": string,"author_role": Database["public"]['Enums']["author_role"],"created_at"?: string,"id": string,"kind": Database["public"]['Enums']["annotation_kind"],"points"?: (number)[] | null,"room_id": string,"session_id": string,"student_ids"?: (string)[],"style": NonNullable<Json>,"words"?: (string)[] | null
                  }
                  Update: {
                    "anchor"?: Json | null,"author_id"?: string,"author_role"?: Database["public"]['Enums']["author_role"],"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["annotation_kind"],"points"?: (number)[] | null,"room_id"?: string,"session_id"?: string,"student_ids"?: (string)[],"style"?: NonNullable<Json>,"words"?: (string)[] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "annotations_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "annotations_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "live_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "annotations_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"class_members": {
                  Row: {
                    "class_id": string,"joined_at": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"joined_at"?: string,"student_id": string
                  }
                  Update: {
                    "class_id"?: string,"joined_at"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_members_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_members_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "created_at": string,"id": string,"invite_code": string,"invite_open": boolean,"name": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invite_code"?: string,"invite_open"?: boolean,"name": string,"teacher_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invite_code"?: string,"invite_open"?: boolean,"name"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"corrections": {
                  Row: {
                    "author_id": string | null,"author_role": Database["public"]['Enums']["author_role"],"comment": string | null,"created_at": string,"error_type": Database["public"]['Enums']["error_type"],"id": string,"room_id": string | null,"session_id": string,"status": Database["public"]['Enums']["correction_status"],"student_id": string,"tajweed_rule": string | null,"verse": string | null,"word": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"author_role": Database["public"]['Enums']["author_role"],"comment"?: string | null,"created_at"?: string,"error_type": Database["public"]['Enums']["error_type"],"id": string,"room_id"?: string | null,"session_id": string,"status": Database["public"]['Enums']["correction_status"],"student_id": string,"tajweed_rule"?: string | null,"verse"?: never,"word": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_role"?: Database["public"]['Enums']["author_role"],"comment"?: string | null,"created_at"?: string,"error_type"?: Database["public"]['Enums']["error_type"],"id"?: string,"room_id"?: string | null,"session_id"?: string,"status"?: Database["public"]['Enums']["correction_status"],"student_id"?: string,"tajweed_rule"?: string | null,"verse"?: never,"word"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "corrections_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "corrections_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "live_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "corrections_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "corrections_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_announcements": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"session_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_announcements_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"live_participants": {
                  Row: {
                    "activity": Database["public"]['Enums']["participant_activity"],"current_verse": string | null,"hand_raised_at": string | null,"joined_at": string,"last_seen_at": string,"room_id": string | null,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity"?: Database["public"]['Enums']["participant_activity"],"current_verse"?: string | null,"hand_raised_at"?: string | null,"joined_at"?: string,"last_seen_at"?: string,"room_id"?: string | null,"session_id": string,"user_id": string
                  }
                  Update: {
                    "activity"?: Database["public"]['Enums']["participant_activity"],"current_verse"?: string | null,"hand_raised_at"?: string | null,"joined_at"?: string,"last_seen_at"?: string,"room_id"?: string | null,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_participants_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "live_rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_participants_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_rooms": {
                  Row: {
                    "capacity": number,"closed": boolean,"created_at": string,"id": string,"kind": Database["public"]['Enums']["room_kind"],"leader_id": string | null,"name": string,"position": number,"quiz": Json | null,"session_id": string,"student_pen": boolean,"teacher_visited_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number,"closed"?: boolean,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["room_kind"],"leader_id"?: string | null,"name": string,"position"?: number,"quiz"?: Json | null,"session_id": string,"student_pen"?: boolean,"teacher_visited_at"?: string | null
                  }
                  Update: {
                    "capacity"?: number,"closed"?: boolean,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["room_kind"],"leader_id"?: string | null,"name"?: string,"position"?: number,"quiz"?: Json | null,"session_id"?: string,"student_pen"?: boolean,"teacher_visited_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_rooms_leader_id_fkey"
      columns: ["leader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_rooms_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"live_sessions": {
                  Row: {
                    "class_id": string,"created_at": string,"created_by": string | null,"current_step": number,"ended_at": string | null,"floor_user": string | null,"focus_verse": string | null,"id": string,"notes": string | null,"passage": Json | null,"plan": NonNullable<Json>,"room_mode": string,"show_summary": boolean,"started_at": string | null,"status": Database["public"]['Enums']["session_status"],"step_started_at": string | null,"tajweed_focus": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"created_by"?: string | null,"current_step"?: number,"ended_at"?: string | null,"floor_user"?: string | null,"focus_verse"?: string | null,"id"?: string,"notes"?: string | null,"passage"?: Json | null,"plan"?: NonNullable<Json>,"room_mode"?: string,"show_summary"?: boolean,"started_at"?: string | null,"status"?: Database["public"]['Enums']["session_status"],"step_started_at"?: string | null,"tajweed_focus"?: string | null,"title"?: string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"created_by"?: string | null,"current_step"?: number,"ended_at"?: string | null,"floor_user"?: string | null,"focus_verse"?: string | null,"id"?: string,"notes"?: string | null,"passage"?: Json | null,"plan"?: NonNullable<Json>,"room_mode"?: string,"show_summary"?: boolean,"started_at"?: string | null,"status"?: Database["public"]['Enums']["session_status"],"step_started_at"?: string | null,"tajweed_focus"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_sessions_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_sessions_floor_user_fkey"
      columns: ["floor_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    
                  ]
                },"staff_invitations": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"expires_at": string,"note": string | null,"role": Database["public"]['Enums']["app_role"],"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"note"?: string | null,"role": Database["public"]['Enums']["app_role"],"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"note"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invitations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invitations_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teacher_notes": {
                  Row: {
                    "ayah": number,"content": string,"created_at": string,"id": string,"surah": number,"teacher_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ayah": number,"content": string,"created_at"?: string,"id"?: string,"surah": number,"teacher_id": string,"updated_at"?: string
                  }
                  Update: {
                    "ayah"?: number,"content"?: string,"created_at"?: string,"id"?: string,"surah"?: number,"teacher_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_notes_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verse_progress": {
                  Row: {
                    "ayah": number,"last_reviewed_at": string | null,"status": Database["public"]['Enums']["verse_status"],"student_id": string,"surah": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ayah": number,"last_reviewed_at"?: string | null,"status": Database["public"]['Enums']["verse_status"],"student_id": string,"surah": number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "ayah"?: number,"last_reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["verse_status"],"student_id"?: string,"surah"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "verse_progress_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verse_progress_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verse_results": {
                  Row: {
                    "author_id": string | null,"created_at": string,"id": string,"result": Database["public"]['Enums']["verse_result"],"session_id": string,"student_id": string,"verse": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"result": Database["public"]['Enums']["verse_result"],"session_id": string,"student_id": string,"verse": string
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"result"?: Database["public"]['Enums']["verse_result"],"session_id"?: string,"student_id"?: string,"verse"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verse_results_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verse_results_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verse_results_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_list_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"display_name": string,"email": string,"id": string,"last_sign_in_at": string,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"admin_set_role":
{ Args: { "new_role": Database["public"]['Enums']["app_role"],"target": string }; Returns: undefined
                           },
"attends_session":
{ Args: { "target": string }; Returns: boolean
                           },
"can_annotate":
{ Args: { "target": string }; Returns: boolean
                           },
"can_correct":
{ Args: { "student": string,"target": string }; Returns: boolean
                           },
"check_invite":
{ Args: { "code": string }; Returns: {
              "class_name": string,"kind": string,"role": Database["public"]['Enums']["app_role"],"teacher_name": string
            }[]
                           },
"choose_room":
{ Args: { "room_id": string,"session_id": string }; Returns: undefined
                           },
"clear_board":
{ Args: { "room_id": string }; Returns: undefined
                           },
"close_room":
{ Args: { "room_id": string,"session_id": string }; Returns: undefined
                           },
"current_role_is":
{ Args: { "roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"end_quiz":
{ Args: { "room_id": string }; Returns: undefined
                           },
"end_session":
{ Args: { "session_id": string }; Returns: undefined
                           },
"gen_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"in_room":
{ Args: { "target": string,"who": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_class":
{ Args: { "code": string }; Returns: string
                           },
"join_session":
{ Args: { "session_id": string }; Returns: string
                           },
"main_room":
{ Args: { "target": string }; Returns: string
                           },
"member_of_class":
{ Args: { "target": string }; Returns: boolean
                           },
"move_participant":
{ Args: { "room_id": string,"session_id": string,"user_id": string }; Returns: undefined
                           },
"my_sessions":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"open_room_session":
{ Args: { "target": string }; Returns: string
                           },
"open_rooms":
{ Args: { "capacity"?: number,"groups": Json,"mode": string,"room_count": number,"session_id": string }; Returns: undefined
                           },
"recall_all":
{ Args: { "session_id": string }; Returns: undefined
                           },
"regenerate_invite_code":
{ Args: { "class_id": string }; Returns: string
                           },
"require_teacher":
{ Args: { "target": string }; Returns: undefined
                           },
"reveal_quiz":
{ Args: { "room_id": string }; Returns: undefined
                           },
"room_board":
{ Args: { "room_id": string }; Returns: Json
                           },
"session_error_summary":
{ Args: { "session_id": string }; Returns: Json
                           },
"session_recap":
{ Args: { "session_id": string }; Returns: Json
                           },
"session_state":
{ Args: { "session_id": string }; Returns: Json
                           },
"set_floor":
{ Args: { "session_id": string,"user_id": string }; Returns: undefined
                           },
"set_room_leader":
{ Args: { "room_id": string,"take": boolean }; Returns: undefined
                           },
"set_room_pen":
{ Args: { "allowed": boolean,"room_id": string }; Returns: undefined
                           },
"set_step":
{ Args: { "session_id": string,"step": number }; Returns: undefined
                           },
"shares_class_with":
{ Args: { "other": string }; Returns: boolean
                           },
"start_quiz":
{ Args: { "room_id": string,"student_id": string }; Returns: string
                           },
"start_session":
{ Args: { "session_id": string }; Returns: undefined
                           },
"taught_by":
{ Args: { "teacher": string }; Returns: boolean
                           },
"teaches_class":
{ Args: { "target": string }; Returns: boolean
                           },
"teaches_session":
{ Args: { "target": string }; Returns: boolean
                           },
"teaches_student":
{ Args: { "student": string }; Returns: boolean
                           }
          }
          Enums: {
            "annotation_kind": "stroke"|"mark","app_role": "student"|"teacher"|"admin","author_role": "teacher"|"peer","correction_status": "confirmed"|"pending","error_type": "pronunciation"|"tajweed"|"haraka"|"forgotten"|"added"|"memory","participant_activity": "idle"|"listening"|"reciting","room_kind": "main"|"breakout","session_status": "planned"|"live"|"ended","verse_result": "validated"|"review","verse_status": "new"|"learning"|"acquired"|"review"
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
  "public": {
          Enums: {
            "annotation_kind": ["stroke", "mark"],"app_role": ["student", "teacher", "admin"],"author_role": ["teacher", "peer"],"correction_status": ["confirmed", "pending"],"error_type": ["pronunciation", "tajweed", "haraka", "forgotten", "added", "memory"],"participant_activity": ["idle", "listening", "reciting"],"room_kind": ["main", "breakout"],"session_status": ["planned", "live", "ended"],"verse_result": ["validated", "review"],"verse_status": ["new", "learning", "acquired", "review"]
          }
        }
} as const
