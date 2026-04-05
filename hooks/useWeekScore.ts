import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { WeeklyScore } from '@/types'

function getWeekOf(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().slice(0, 10)
}

export function useWeekScore(userId: string) {
  const [weekScore, setWeekScore] = useState<WeeklyScore | null>(null)
  const [history, setHistory] = useState<WeeklyScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchScores() }, [userId])

  async function fetchScores() {
    setLoading(true)
    const weekOf = getWeekOf()
    const [cur, hist] = await Promise.all([
      supabase.from('weekly_scores').select('*').eq('user_id', userId).eq('week_of', weekOf).single(),
      supabase.from('weekly_scores').select('*').eq('user_id', userId).order('week_of', { ascending: false }).limit(13),
    ])
    if (cur.data) setWeekScore(cur.data as WeeklyScore)
    if (hist.data) setHistory(hist.data as WeeklyScore[])
    setLoading(false)
  }

  return { weekScore, history, loading, refetch: fetchScores }
}
