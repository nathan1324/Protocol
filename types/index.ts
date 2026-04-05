// ─── Protocol Core Types ───────────────────────────────────────────────────

export type TaskType = 'protocol' | 'stack' | 'stretch'
export type TaskSource = 'standup' | 'quick_add' | 'passive_confirm' | 'close'
export type EnergySignal = 'high' | 'medium' | 'low'
export type SessionType = 'standup' | 'close'
export type ProtocolCategory = 'health' | 'focus' | 'finance' | 'relationships' | 'creative' | 'admin'

// ─── Database Row Types ────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  timezone: string
  standup_time: string        // "07:30" format
  current_streak: number
  season_num: number
  created_at: string
}

export interface ProtocolItem {
  id: string
  user_id: string
  label: string
  category: ProtocolCategory
  active_days: number[]       // 0=Sun, 1=Mon ... 6=Sat
  source: 'user_created' | 'memory_suggested' | 'onboarding'
  active: boolean
  completion_rate: number     // 0.0 to 1.0, rolling 28-day
  created_at: string
}

export interface DailyLog {
  id: string
  user_id: string
  date: string                // ISO date "2025-04-07"
  task_label: string
  task_type: TaskType
  pts_possible: number
  pts_earned: number
  completed: boolean
  completed_at: string | null
  source: TaskSource
  protocol_item_id: string | null  // FK if task_type === 'protocol'
}

export interface StandupSession {
  id: string
  user_id: string
  date: string
  session_type: SessionType
  mode: 'chat' | 'voice'
  messages: ChatMessage[]
  output: StandupOutput | null
  energy_signal: EnergySignal | null
  carry_forward: string | null    // from close sessions
  duration_sec: number
  created_at: string
}

export interface WeeklyScore {
  id: string
  user_id: string
  week_of: string             // Monday ISO date
  season_num: number
  total_pts: number
  protocol_pts: number
  stack_pts: number
  stretch_pts: number
  protocol_rate: number       // 0.0 to 1.0
  perfect_days: number
  stretch_wins: number
  peak_moment: string | null
  forward_line: string | null
}

// ─── Standup / Close Types ─────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CapturedItem {
  type: TaskType
  label: string
  pts: number
}

export interface CaptureBlock {
  items: CapturedItem[]
}

export interface CloseBlock {
  energy: EnergySignal
  carry_forward: string
  reflection: string
}

export interface StandupOutput {
  date: string
  protocol_today: Array<{ id: string; label: string; confirmed: boolean }>
  stack_today: Array<{ label: string; pts: number }>
  stretch_today: Array<{ label: string; pts: number }>
  potential_pts: number
  energy_signal: EnergySignal
  anchor_task: string | null
  carry_forward?: string
}

// ─── Scoring Types ─────────────────────────────────────────────────────────

export interface DailyScore {
  date: string
  protocol_pts: number
  stack_pts: number
  stretch_pts: number
  multiplier_pts: number
  total: number
  perfect_protocol: boolean
  streak_active: boolean
}

export interface WeekData {
  days: DailyScore[]
  total: number
  protocol_rate: number
  perfect_days: number
  stretch_wins: number
}

// ─── UI / State Types ──────────────────────────────────────────────────────

export interface StandupState {
  messages: ChatMessage[]
  capturedItems: CapturedItem[]
  isLoading: boolean
  isComplete: boolean
  output: StandupOutput | null
  error: string | null
}

export interface DayState {
  date: string
  logs: DailyLog[]
  earnedPts: number
  potentialPts: number
  completionRate: number
  protocolComplete: boolean
}

export interface AppNotification {
  type: 'standup_reminder' | 'close_reminder' | 'weekly_scorecard'
  title: string
  body: string
  scheduledFor: Date
}
