import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { DailyLog, ProtocolItem, TaskType } from '@/types'
import { assignTaskPoints } from '@/lib/scoring'

export function useDailyLog(userId: string, date: string) {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) fetchLogs()
    else setLoading(false)
  }, [userId, date])

  async function fetchLogs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_logs').select('*')
      .eq('user_id', userId).eq('date', date)
      .order('created_at', { ascending: true })
    if (error) console.error('[useDailyLog] fetchLogs error:', error)
    setLogs((data as DailyLog[]) ?? [])
    setLoading(false)
  }

  async function seedFromStandup(
    protocolItems: ProtocolItem[],
    stackItems: Array<{ label: string }>,
    stretchItems: Array<{ label: string }>
  ) {
    console.log('[useDailyLog] seedFromStandup called with userId:', userId, 'date:', date)
    console.log('[useDailyLog] protocolItems:', protocolItems.length, 'stackItems:', stackItems.length, 'stretchItems:', stretchItems.length)

    if (!userId) {
      console.error('[useDailyLog] seedFromStandup: userId is empty, aborting')
      return { error: { message: 'No user ID' } }
    }

    const rows = [
      ...protocolItems.map(i => ({
        user_id: userId,
        date,
        task_label: i.label,
        task_type: 'protocol' as TaskType,
        protocol_item_id: i.id,
        source: 'standup' as const,
        completed: false,
        completed_at: null,
        ...assignTaskPoints('protocol'),
      })),
      ...stackItems.map(i => ({
        user_id: userId,
        date,
        task_label: i.label,
        task_type: 'stack' as TaskType,
        protocol_item_id: null,
        source: 'standup' as const,
        completed: false,
        completed_at: null,
        ...assignTaskPoints('stack'),
      })),
      ...stretchItems.map(i => ({
        user_id: userId,
        date,
        task_label: i.label,
        task_type: 'stretch' as TaskType,
        protocol_item_id: null,
        source: 'standup' as const,
        completed: false,
        completed_at: null,
        ...assignTaskPoints('stretch'),
      })),
    ]

    console.log('[useDailyLog] inserting rows:', JSON.stringify(rows, null, 2))

    if (rows.length === 0) {
      console.warn('[useDailyLog] no rows to insert')
      return { error: null }
    }

    const { error } = await supabase.from('daily_logs').insert(rows)
    if (error) {
      console.error('[useDailyLog] insert error:', JSON.stringify(error))
    } else {
      console.log('[useDailyLog] insert success, fetching updated logs')
      await fetchLogs()
    }
    return { error }
  }

  async function completeTask(id: string, taskType: TaskType) {
    const pts = assignTaskPoints(taskType).pts_possible
    const { error } = await supabase.from('daily_logs')
      .update({ completed: true, pts_earned: pts, completed_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) await fetchLogs()
    return { error }
  }

  async function uncompleteTask(id: string) {
    const { error } = await supabase.from('daily_logs')
      .update({ completed: false, pts_earned: 0, completed_at: null }).eq('id', id)
    if (!error) await fetchLogs()
    return { error }
  }

  async function quickAdd(label: string, taskType: TaskType) {
    const { error } = await supabase.from('daily_logs').insert({
      user_id: userId, date, task_label: label, task_type: taskType,
      source: 'quick_add', protocol_item_id: null,
      completed: false, completed_at: null,
      ...assignTaskPoints(taskType),
    })
    if (!error) await fetchLogs()
    return { error }
  }

  return { logs, loading, seedFromStandup, completeTask, uncompleteTask, quickAdd, refetch: fetchLogs }
}
