import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useWeekScore } from '@/hooks/useWeekScore'

function getWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function ScoreScreen() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const { weekScore, history, loading } = useWeekScore(userId ?? '')

  const seasonNum = weekScore?.season_num ?? 1
  const totalPts = weekScore?.total_pts ?? 0
  const protocolRate = weekScore?.protocol_rate ?? 0
  const perfectDays = weekScore?.perfect_days ?? 0
  const stretchWins = weekScore?.stretch_wins ?? 0
  const peakMoment = weekScore?.peak_moment ?? null

  // Current streak from history
  const streak = history.filter(w => w.total_pts > 0).length

  const todayIndex = (new Date().getDay() + 6) % 7

  if (!userId || loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={Colors.scoreGold} size="small" />
      </View>
    )
  }

  // Empty state
  if (!weekScore && !loading) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyTitle}>Your first week is in progress.</Text>
        <Text style={s.emptyBody}>Check back Sunday.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ──────────────────────────────────── */}
      <View style={s.headerBlock}>
        <Text style={s.headerLabel}>SEASON {seasonNum} · WEEK {getWeekNumber()}</Text>
        <Text style={s.scoreNumber}>{totalPts}</Text>
        <Text style={s.scoreLabel}>total points</Text>
      </View>

      {/* ── Stacked Bar Chart ────────────────────────── */}
      <View style={s.chartCard}>
        <Text style={s.chartTitle}>THIS WEEK</Text>
        <View style={s.chartRow}>
          {DAY_LABELS.map((day, i) => {
            const isToday = i === todayIndex
            const isPast = i < todayIndex
            // Distribute total across days as placeholder
            const dayTotal = weekScore ? Math.round(weekScore.total_pts / 7) : 0
            const pProto = weekScore ? weekScore.protocol_pts / Math.max(1, weekScore.total_pts) : 0.4
            const pStack = weekScore ? weekScore.stack_pts / Math.max(1, weekScore.total_pts) : 0.4
            const maxH = 80
            const totalH = isPast || isToday ? Math.max(4, Math.min(maxH, dayTotal * 1.5)) : 3
            const protoH = Math.round(totalH * pProto)
            const stackH = Math.round(totalH * pStack)
            const stretchH = Math.max(0, totalH - protoH - stackH)

            return (
              <View key={i} style={s.chartCol}>
                <View style={[s.chartBarContainer, isToday && s.chartBarToday]}>
                  {stretchH > 0 && (
                    <View style={[s.chartSeg, { height: stretchH, backgroundColor: Colors.stretchAmber }]} />
                  )}
                  {stackH > 0 && (
                    <View style={[s.chartSeg, { height: stackH, backgroundColor: Colors.stackTeal }]} />
                  )}
                  {protoH > 0 && (
                    <View style={[s.chartSegBottom, { height: protoH, backgroundColor: Colors.protocolPurple }]} />
                  )}
                </View>
                <Text style={[s.chartDayLabel, isToday && s.chartDayLabelToday]}>{day}</Text>
              </View>
            )
          })}
        </View>
        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: Colors.protocolPurple }]} />
            <Text style={s.legendText}>Protocol</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: Colors.stackTeal }]} />
            <Text style={s.legendText}>Stack</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: Colors.stretchAmber }]} />
            <Text style={s.legendText}>Stretch</Text>
          </View>
        </View>
      </View>

      {/* ── Stat Cards 2x2 ───────────────────────────── */}
      <View style={s.statsGrid}>
        <View style={[s.statCard, { borderColor: Colors.protocolPurpleBorder }]}>
          <Text style={s.statLabel}>PROTOCOL RATE</Text>
          <Text style={[s.statValue, { color: Colors.protocolPurple }]}>{Math.round(protocolRate * 100)}%</Text>
          <Text style={s.statSub}>{perfectDays} perfect days</Text>
        </View>
        <View style={[s.statCard, { borderColor: Colors.stretchAmberBorder }]}>
          <Text style={s.statLabel}>STRETCH WINS</Text>
          <Text style={[s.statValue, { color: Colors.stretchAmber }]}>{stretchWins}</Text>
          <Text style={s.statSub}>this week</Text>
        </View>
        <View style={[s.statCard, { borderColor: Colors.border }]}>
          <Text style={s.statLabel}>CURRENT STREAK</Text>
          <Text style={[s.statValue, { color: Colors.textPrimary }]}>{streak}</Text>
          <Text style={s.statSub}>{streak === 1 ? 'week' : 'weeks'} running</Text>
        </View>
        <View style={[s.statCard, { borderColor: Colors.scoreGoldBorder }]}>
          <Text style={s.statLabel}>SEASON RANK</Text>
          <Text style={[s.statValue, { color: Colors.scoreGold }]}>#{Math.max(1, Math.ceil(history.length / 2))}</Text>
          <Text style={s.statSub}>of {Math.max(1, history.length)} weeks</Text>
        </View>
      </View>

      {/* ── Insight Card ─────────────────────────────── */}
      <View style={s.insightCard}>
        <Text style={s.insightLabel}>PROTOCOL NOTICED</Text>
        <Text style={s.insightText}>
          {peakMoment || 'Your patterns are forming. Complete a full week to unlock insights.'}
        </Text>
      </View>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Empty state
  emptyTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Header
  headerBlock: {
    marginTop: 80,
    marginBottom: 32,
    alignItems: 'center',
  },
  headerLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    color: Colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scoreNumber: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 64,
    color: Colors.scoreGold,
    marginTop: 4,
  },
  scoreLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Chart card
  chartCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  chartTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    color: Colors.textTertiary,
    letterSpacing: 2,
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarContainer: {
    width: 16,
    height: 80,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBarToday: {
    borderWidth: 1,
    borderColor: Colors.scoreGold,
    borderRadius: 5,
  },
  chartSeg: {
    width: '100%',
  },
  chartSegBottom: {
    width: '100%',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  chartDayLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 9,
    color: Colors.textTertiary,
    marginTop: 8,
  },
  chartDayLabelToday: {
    color: Colors.scoreGold,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: Colors.textTertiary,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.bgSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
  },
  statLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 8,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 28,
  },
  statSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Insight card
  insightCard: {
    backgroundColor: Colors.scoreGoldBg,
    borderRadius: 16,
    padding: 18,
    borderWidth: 0.5,
    borderColor: Colors.scoreGoldBorder,
  },
  insightLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 8,
    color: Colors.scoreGold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  insightText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
})
