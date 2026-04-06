import { useState, useEffect, useMemo, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useWeekScore } from '@/hooks/useWeekScore'
import { useProtocolItems } from '@/hooks/useProtocolItems'
import { useDailyLog } from '@/hooks/useDailyLog'

const { width: SCREEN_W } = Dimensions.get('window')

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
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
  const [seasonNum, setSeasonNum] = useState(1)
  const [standupDone, setStandupDone] = useState(false)
  const date = todayISO()
  const fadeIn = useRef(new Animated.Value(0)).current
  const slideUp = useRef(new Animated.Value(20)).current

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
      if (profile?.season_num) setSeasonNum(profile.season_num)

      const { data: session } = await supabase
        .from('standup_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('session_type', 'standup')
        .limit(1)
        .single()
      setStandupDone(!!session)

      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start()
    }
    load()
  }, [])

  const { weekScore } = useWeekScore(userId ?? '')
  const { items: protocolItems } = useProtocolItems(userId ?? '')
  const { logs } = useDailyLog(userId ?? '', date)

  const earnedToday = useMemo(() => logs.reduce((s, l) => s + l.pts_earned, 0), [logs])
  const potentialToday = useMemo(() => logs.reduce((s, l) => s + l.pts_possible, 0), [logs])
  const currentTotal = weekScore?.total_pts ?? 0
  const todayIndex = (new Date().getDay() + 6) % 7
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  if (!userId) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={Colors.scoreGold} size="small" />
      </View>
    )
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Ambient gold glow at top */}
      <LinearGradient
        colors={['rgba(196,154,60,0.06)', 'rgba(196,154,60,0)', Colors.bgPrimary]}
        style={s.ambientGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

        {/* ── Greeting ─────────────────────────────────── */}
        <View style={s.greetingBlock}>
          <Text style={s.greetingLine}>{getGreeting()}</Text>
          <Text style={s.greetingName}>{userName || 'there'}.</Text>
          <Text style={s.greetingDate}>{formatDate()}</Text>
        </View>

        {/* ── Score Card ───────────────────────────────── */}
        <View style={s.scoreCard}>
          {/* Inner glow */}
          <LinearGradient
            colors={['rgba(196,154,60,0.08)', 'rgba(196,154,60,0)']}
            style={s.scoreGlow}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={s.scoreInner}>
            <Text style={s.seasonLabel}>Q{seasonNum} · WEEK {getWeekNumber()}</Text>
            <Text style={s.scoreNumber}>{currentTotal}</Text>
            <Text style={s.scoreUnit}>pts this week</Text>

            <View style={s.divider} />

            {/* Day columns */}
            <View style={s.dayRow}>
              {dayLabels.map((day, i) => {
                const isToday = i === todayIndex
                const isPast = i < todayIndex
                const barH = isToday
                  ? Math.max(8, earnedToday * 2)
                  : isPast
                    ? Math.max(4, Math.round(Math.random() * 24 + 6))
                    : 3
                return (
                  <View key={i} style={s.dayCol}>
                    <View style={s.dayBarContainer}>
                      <View style={[
                        s.dayBar,
                        { height: Math.min(36, barH) },
                        isToday && s.dayBarToday,
                      ]} />
                    </View>
                    <Text style={[s.dayLabel, isToday && s.dayLabelToday]}>{day}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        </View>

        {/* ── Today's Progress (if standup done) ─────── */}
        {standupDone && potentialToday > 0 && (
          <Pressable style={s.progressCard} onPress={() => router.push('/(tabs)/today')}>
            <View style={s.progressTop}>
              <Text style={s.progressLabel}>TODAY</Text>
              <Text style={s.progressPts}>
                <Text style={s.progressEarned}>{earnedToday}</Text>
                <Text style={s.progressSlash}> / {potentialToday}</Text>
              </Text>
            </View>
            <View style={s.progressBarBg}>
              <LinearGradient
                colors={[Colors.scoreGold, 'rgba(196,154,60,0.6)']}
                style={[s.progressBarFill, { width: `${Math.round((earnedToday / potentialToday) * 100)}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={s.progressAction}>View today →</Text>
          </Pressable>
        )}

        {/* ── Your Protocol ────────────────────────────── */}
        <View style={s.protocolSection}>
          <View style={s.protocolHeader}>
            <Text style={s.protocolTitle}>YOUR PROTOCOL</Text>
            <Pressable hitSlop={12}>
              <Text style={s.protocolEdit}>Edit</Text>
            </Pressable>
          </View>
          {protocolItems.length > 0 ? (
            protocolItems.map((item, i) => (
              <View key={item.id || i} style={s.protocolRow}>
                <View style={s.protocolDotOuter}>
                  <View style={s.protocolDotInner} />
                </View>
                <Text style={s.protocolLabel}>{item.label}</Text>
              </View>
            ))
          ) : (
            <Text style={s.protocolEmpty}>No protocol items yet</Text>
          )}
        </View>

        {/* ── CTA ──────────────────────────────────────── */}
        {!standupDone && (
          <Pressable
            style={({ pressed }) => [s.standupCta, pressed && s.standupCtaPressed]}
            onPress={() => router.push('/standup')}
          >
            <LinearGradient
              colors={[Colors.scoreGold, Colors.scoreGoldLight]}
              style={s.standupCtaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={s.standupCtaText}>Begin standup</Text>
              <Text style={s.standupCtaArrow}>→</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* ── Close the day — after 5pm ────────────────── */}
        {new Date().getHours() >= 17 && standupDone && (
          <Pressable style={s.closeCta} onPress={() => router.push('/close')}>
            <Text style={s.closeCtaText}>Close the day</Text>
          </Pressable>
        )}

      </Animated.View>
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
  },
  ambientGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },

  // ── Greeting ────────────────────────────────────
  greetingBlock: {
    marginTop: 100,
    marginBottom: 36,
  },
  greetingLine: {
    fontFamily: 'Lora_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  greetingName: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 38,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  greetingDate: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 8,
  },

  // ── Score Card ──────────────────────────────────
  scoreCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  scoreGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  scoreInner: {
    backgroundColor: Colors.bgSurface,
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  seasonLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    color: Colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scoreNumber: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 52,
    color: Colors.scoreGold,
    marginTop: 8,
  },
  scoreUnit: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 18,
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
  },
  dayBarContainer: {
    height: 40,
    width: 3,
    justifyContent: 'flex-end',
  },
  dayBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.protocolPurple,
  },
  dayBarToday: {
    borderWidth: 1,
    borderColor: Colors.scoreGold,
    width: 5,
    marginLeft: -1,
  },
  dayLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 9,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  dayLabelToday: {
    color: Colors.scoreGold,
  },

  // ── Progress Card ───────────────────────────────
  progressCard: {
    marginTop: 16,
    backgroundColor: Colors.bgSurface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(196,154,60,0.15)',
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    color: Colors.textTertiary,
    letterSpacing: 2,
  },
  progressPts: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
  },
  progressEarned: {
    color: Colors.scoreGold,
  },
  progressSlash: {
    color: Colors.textTertiary,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  progressAction: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.scoreGold,
    marginTop: 12,
    textAlign: 'right',
  },

  // ── Protocol ────────────────────────────────────
  protocolSection: {
    marginTop: 32,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  protocolTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    color: Colors.protocolPurple,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  protocolEdit: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.scoreGold,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    gap: 12,
  },
  protocolDotOuter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(139,127,212,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  protocolDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.protocolPurple,
  },
  protocolLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  protocolEmpty: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 4,
  },

  // ── Standup CTA ─────────────────────────────────
  standupCta: {
    marginTop: 36,
    borderRadius: 16,
    overflow: 'hidden',
    // Subtle shadow
    shadowColor: Colors.scoreGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  standupCtaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  standupCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 8,
  },
  standupCtaText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: '#0A0A0D',
  },
  standupCtaArrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    color: '#0A0A0D',
    opacity: 0.6,
  },

  // ── Close CTA ───────────────────────────────────
  closeCta: {
    marginTop: 12,
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  closeCtaText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
