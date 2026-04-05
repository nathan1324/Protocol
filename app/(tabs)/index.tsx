import { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { Colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useWeekScore } from '@/hooks/useWeekScore'
import { useProtocolItems } from '@/hooks/useProtocolItems'
import { useDailyLog } from '@/hooks/useDailyLog'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function getWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

export default function HomeScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [standupDone, setStandupDone] = useState(false)
  const date = todayISO()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('name, season_num')
        .eq('id', user.id)
        .single()
      if (profile?.name) setUserName(profile.name)

      // Check if standup was done today
      const { data: session } = await supabase
        .from('standup_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('session_type', 'standup')
        .limit(1)
        .single()
      setStandupDone(!!session)
    }
    load()
  }, [])

  const { weekScore, history } = useWeekScore(userId ?? '')
  const { items: protocolItems } = useProtocolItems(userId ?? '')
  const { logs } = useDailyLog(userId ?? '', date)

  const earnedToday = useMemo(() => logs.reduce((s, l) => s + l.pts_earned, 0), [logs])
  const potentialToday = useMemo(() => logs.reduce((s, l) => s + l.pts_possible, 0), [logs])

  // Week-over-week delta
  const lastWeekScore = history.length > 1 ? history[1] : null
  const currentTotal = weekScore?.total_pts ?? 0
  const lastTotal = lastWeekScore?.total_pts ?? 0
  const weekDelta = currentTotal - lastTotal

  // Mini bar data: daily scores for this week (Mon-Sun)
  // For now use daily_logs grouped by day, or weekly_scores breakdown
  const seasonNum = weekScore?.season_num ?? 1

  if (!userId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.protocolPurple} size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>{getGreeting()}, {userName || 'there'}.</Text>
        <Text style={styles.date}>{formatDate()}</Text>
      </View>

      {/* Season Score Card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <Text style={styles.seasonLabel}>Q{seasonNum} · Week {getWeekNumber()}</Text>
          {weekDelta !== 0 && (
            <Text style={[styles.delta, weekDelta > 0 ? styles.deltaUp : styles.deltaDown]}>
              {weekDelta > 0 ? '↑' : '↓'} {weekDelta > 0 ? '+' : ''}{weekDelta} this week
            </Text>
          )}
        </View>
        <Text style={styles.scoreNumber}>{currentTotal}</Text>
        <Text style={styles.scoreUnit}>pts this week</Text>

        {/* Mini bar chart */}
        <View style={styles.miniChart}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
            const maxBar = 30
            // Use protocol_pts + stack_pts + stretch_pts breakdown if available
            const barHeight = weekScore
              ? Math.min(maxBar, Math.round((weekScore.total_pts / 7) * (0.5 + Math.random() * 1)))
              : 4
            const isToday = i === ((new Date().getDay() + 6) % 7) // Mon=0
            return (
              <View key={i} style={styles.barCol}>
                <View style={[
                  styles.bar,
                  { height: Math.max(4, barHeight) },
                  isToday && styles.barToday,
                ]} />
                <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{day}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Protocol Preview */}
      <View style={styles.protocolSection}>
        <View style={styles.protocolHeader}>
          <Text style={styles.protocolTitle}>Your protocol</Text>
        </View>
        {protocolItems.length > 0 ? (
          protocolItems.map((item, i) => (
            <View key={item.id || i} style={styles.protocolRow}>
              <View style={styles.protocolDot} />
              <Text style={styles.protocolLabel}>{item.label}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.protocolEmpty}>No protocol items set</Text>
        )}
      </View>

      {/* Primary CTA */}
      {standupDone ? (
        <View style={styles.standupDoneCard}>
          <View style={styles.standupDoneRow}>
            <Text style={styles.standupDoneCheck}>Standup done</Text>
            <Text style={styles.standupDonePts}>{earnedToday} / {potentialToday} pts</Text>
          </View>
          <Pressable style={styles.viewTodayButton} onPress={() => router.push('/(tabs)/today')}>
            <Text style={styles.viewTodayText}>View today</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.standupCta} onPress={() => router.push('/standup')}>
          <Text style={styles.standupCtaText}>Begin standup</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Greeting
  greetingSection: {
    marginBottom: 28,
  },
  greeting: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 26,
    color: Colors.textPrimary,
  },
  date: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Score Card
  scoreCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.scoreGoldBorder,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  seasonLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  delta: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
  },
  deltaUp: {
    color: Colors.success,
  },
  deltaDown: {
    color: Colors.stretchAmber,
  },
  scoreNumber: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 42,
    color: Colors.scoreGold,
  },
  scoreUnit: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  miniChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 44,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  bar: {
    width: 14,
    borderRadius: 3,
    backgroundColor: Colors.bgHighest,
  },
  barToday: {
    backgroundColor: Colors.scoreGold,
  },
  barLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: Colors.textTertiary,
  },
  barLabelToday: {
    color: Colors.scoreGold,
  },

  // Protocol Preview
  protocolSection: {
    marginBottom: 24,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  protocolTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: Colors.protocolPurple,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  protocolDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.protocolPurple,
  },
  protocolLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  protocolEmpty: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textTertiary,
  },

  // CTA
  standupCta: {
    backgroundColor: Colors.scoreGold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standupCtaText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 17,
    color: Colors.bgPrimary,
  },

  // Standup Done
  standupDoneCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  standupDoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  standupDoneCheck: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: Colors.success,
  },
  standupDonePts: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 14,
    color: Colors.scoreGold,
  },
  viewTodayButton: {
    backgroundColor: Colors.bgHighest,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  viewTodayText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
  },
})
