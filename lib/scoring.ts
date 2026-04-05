import { DailyLog, DailyScore, WeekData, TaskType } from '@/types'
import { Points, PERFECT_PROTOCOL_MULTIPLIER, STREAK_BONUS_PTS } from '@/constants/colors'

// ─── Base Points ──────────────────────────────────────────────────────────

export function getPointValue(taskType: TaskType): number {
  return Points[taskType]
}

// ─── Daily Score Calculation ──────────────────────────────────────────────

export function calculateDailyScore(
  logs: DailyLog[],
  rollingAverage: number,
  currentStreak: number
): DailyScore {
  const date = logs[0]?.date ?? new Date().toISOString().slice(0, 10)
  const completed = logs.filter(l => l.completed)

  const protocolLogs = completed.filter(l => l.task_type === 'protocol')
  const stackLogs = completed.filter(l => l.task_type === 'stack')
  const stretchLogs = completed.filter(l => l.task_type === 'stretch')
  const protocolTotal = logs.filter(l => l.task_type === 'protocol')

  // Base points
  let protocolPts = protocolLogs.length * Points.protocol
  const stackPts = stackLogs.length * Points.stack
  const stretchPts = stretchLogs.length * Points.stretch

  // Perfect protocol bonus — all protocol items completed
  const perfectProtocol =
    protocolTotal.length > 0 &&
    protocolLogs.length === protocolTotal.length

  if (perfectProtocol) {
    protocolPts = Math.round(protocolPts * PERFECT_PROTOCOL_MULTIPLIER)
  }

  // Streak bonus — 3+ days above rolling average
  const baseTotal = protocolPts + stackPts + stretchPts
  const streakActive = currentStreak >= 3 && baseTotal > rollingAverage
  const multiplierPts = streakActive ? STREAK_BONUS_PTS : 0

  return {
    date,
    protocol_pts: protocolPts,
    stack_pts: stackPts,
    stretch_pts: stretchPts,
    multiplier_pts: multiplierPts,
    total: baseTotal + multiplierPts,
    perfect_protocol: perfectProtocol,
    streak_active: streakActive,
  }
}

// ─── Day Potential (before completion) ───────────────────────────────────

export function calculateDayPotential(logs: DailyLog[]): number {
  return logs.reduce((sum, log) => sum + log.pts_possible, 0)
}

// ─── Day Earned (current progress) ───────────────────────────────────────

export function calculateDayEarned(logs: DailyLog[]): number {
  return logs.filter(l => l.completed).reduce((sum, l) => sum + l.pts_earned, 0)
}

// ─── Protocol Completion Rate (for the day) ───────────────────────────────

export function calculateProtocolRate(logs: DailyLog[]): number {
  const protocolLogs = logs.filter(l => l.task_type === 'protocol')
  if (protocolLogs.length === 0) return 0
  const completed = protocolLogs.filter(l => l.completed).length
  return completed / protocolLogs.length
}

// ─── Week Aggregate ───────────────────────────────────────────────────────

export function calculateWeekData(
  dailyScores: DailyScore[]
): WeekData {
  const total = dailyScores.reduce((s, d) => s + d.total, 0)
  const protocolDays = dailyScores.filter(d => d.protocol_pts > 0).length
  const perfectDays = dailyScores.filter(d => d.perfect_protocol).length
  const stretchWins = dailyScores.reduce(
    (s, d) => s + (d.stretch_pts > 0 ? 1 : 0),
    0
  )

  // Protocol rate = days with any protocol completion / active days
  const activeDays = dailyScores.filter(d => d.total > 0).length
  const protocolRate = activeDays > 0 ? protocolDays / activeDays : 0

  return {
    days: dailyScores,
    total,
    protocol_rate: protocolRate,
    perfect_days: perfectDays,
    stretch_wins: stretchWins,
  }
}

// ─── Rolling 28-Day Average ───────────────────────────────────────────────

export function calculateRollingAverage(scores: number[]): number {
  if (scores.length === 0) return 0
  const last28 = scores.slice(-28)
  return last28.reduce((s, n) => s + n, 0) / last28.length
}

// ─── Streak Calculation ───────────────────────────────────────────────────

export function calculateStreak(
  scores: Array<{ date: string; total: number }>,
  rollingAverage: number
): number {
  // Sort descending by date
  const sorted = [...scores].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  let streak = 0
  for (const day of sorted) {
    if (day.total > 0 && day.total >= rollingAverage * 0.6) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ─── Task points assignment (used when creating daily_log rows) ───────────

export function assignTaskPoints(taskType: TaskType): {
  pts_possible: number
  pts_earned: number
} {
  return {
    pts_possible: Points[taskType],
    pts_earned: 0, // always 0 until completed
  }
}

// ─── Score label (for UI display) ────────────────────────────────────────

export function getScoreLabel(total: number, weekAverage: number): string {
  const ratio = weekAverage > 0 ? total / weekAverage : 1
  if (ratio >= 1.3) return 'Exceptional week.'
  if (ratio >= 1.1) return 'Strong week.'
  if (ratio >= 0.9) return 'Solid week.'
  if (ratio >= 0.7) return 'Steady week.'
  return 'Keep the protocol alive.'
}
