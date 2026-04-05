import { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, TaskConfig } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useDailyLog } from '@/hooks/useDailyLog'
import { DailyLog, TaskType } from '@/types'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TodayScreen() {
  const [userId, setUserId] = useState<string | null>(null)
  const date = todayISO()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const { logs, loading, completeTask, uncompleteTask, quickAdd, refetch } = useDailyLog(userId ?? '', date)

  // Re-fetch when screen comes into focus
  useEffect(() => {
    if (userId) refetch()
  }, [userId])

  // Diagnostic: log what's in daily_logs
  useEffect(() => {
    if (!userId || loading) return
    console.log('[today] date:', date, 'userId:', userId)
    console.log('[today] total logs:', logs.length)
    console.log('[today] logs by type:', logs.map(l => ({ label: l.task_label, type: l.task_type, pts: l.pts_possible })))

    // Raw DB check — query without the hook to rule out hook issues
    supabase
      .from('daily_logs')
      .select('task_label, task_type, pts_possible')
      .eq('user_id', userId)
      .eq('date', date)
      .then(({ data, error }) => {
        console.log('[today] RAW DB query result:', JSON.stringify(data))
        if (error) console.error('[today] RAW DB query error:', error)
      })
  }, [userId, logs, loading])

  const protocolLogs = useMemo(() => logs.filter(l => l.task_type === 'protocol'), [logs])
  const stackLogs = useMemo(() => logs.filter(l => l.task_type === 'stack'), [logs])
  const stretchLogs = useMemo(() => logs.filter(l => l.task_type === 'stretch'), [logs])

  const earned = useMemo(() => logs.reduce((s, l) => s + l.pts_earned, 0), [logs])
  const potential = useMemo(() => logs.reduce((s, l) => s + l.pts_possible, 0), [logs])
  const progress = potential > 0 ? earned / potential : 0

  const [quickAddVisible, setQuickAddVisible] = useState(false)
  const [quickAddText, setQuickAddText] = useState('')
  const [quickAddLoading, setQuickAddLoading] = useState(false)

  async function handleQuickAdd() {
    const label = quickAddText.trim()
    if (!label || quickAddLoading) return
    setQuickAddLoading(true)
    await quickAdd(label, 'stack')
    setQuickAddText('')
    setQuickAddVisible(false)
    setQuickAddLoading(false)
  }

  async function handleToggle(log: DailyLog) {
    if (log.completed) {
      await uncompleteTask(log.id)
    } else {
      await completeTask(log.id, log.task_type)
    }
  }

  if (!userId || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.protocolPurple} size="large" />
      </View>
    )
  }

  // Empty state — no standup done yet
  if (logs.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No protocol running yet</Text>
        <Text style={styles.emptyBody}>Begin your standup first</Text>
        <Pressable style={styles.emptyButton} onPress={() => router.push('/standup')}>
          <Text style={styles.emptyButtonText}>Start standup</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header + Progress */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today</Text>
        <Text style={styles.headerPts}>
          <Text style={styles.headerPtsEarned}>{earned}</Text>
          <Text style={styles.headerPtsTotal}> / {potential} pts</Text>
        </Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Protocol Section */}
        {protocolLogs.length > 0 && (
          <Section type="protocol" logs={protocolLogs} onToggle={handleToggle} />
        )}

        {/* Stack Section */}
        {stackLogs.length > 0 && (
          <Section type="stack" logs={stackLogs} onToggle={handleToggle} />
        )}

        {/* Stretch Section */}
        {stretchLogs.length > 0 && (
          <Section type="stretch" logs={stretchLogs} onToggle={handleToggle} />
        )}
      </ScrollView>

      {/* Quick Add */}
      {quickAddVisible ? (
        <View style={styles.quickAddContainer}>
          <TextInput
            style={styles.quickAddInput}
            value={quickAddText}
            onChangeText={setQuickAddText}
            placeholder="Add a stack item..."
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            onSubmitEditing={handleQuickAdd}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.quickAddSend, (!quickAddText.trim() || quickAddLoading) && styles.quickAddSendDisabled]}
            onPress={handleQuickAdd}
            disabled={!quickAddText.trim() || quickAddLoading}
          >
            {quickAddLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.quickAddSendText}>Add</Text>
            )}
          </Pressable>
          <Pressable onPress={() => { setQuickAddVisible(false); setQuickAddText('') }}>
            <Text style={styles.quickAddCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.quickAddBar}>
          <Pressable style={styles.quickAddButton} onPress={() => setQuickAddVisible(true)}>
            <Text style={styles.quickAddButtonPlus}>+</Text>
            <Text style={styles.quickAddButtonText}>Quick add</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

// ─── Section Component ─────────────────────────────────────────────────

function Section({ type, logs, onToggle }: { type: TaskType; logs: DailyLog[]; onToggle: (log: DailyLog) => void }) {
  const config = TaskConfig[type]
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: config.color }]} />
        <Text style={[styles.sectionLabel, { color: config.color }]}>{config.label}</Text>
        <Text style={styles.sectionPts}>+{config.pts} ea</Text>
      </View>
      {logs.map(log => (
        <TaskRow key={log.id} log={log} config={config} onToggle={onToggle} />
      ))}
    </View>
  )
}

// ─── Task Row Component ────────────────────────────────────────────────

function TaskRow({ log, config, onToggle }: { log: DailyLog; config: typeof TaskConfig.protocol; onToggle: (log: DailyLog) => void }) {
  return (
    <Pressable style={styles.taskRow} onPress={() => onToggle(log)}>
      <View style={[
        styles.checkbox,
        { borderColor: config.color },
        log.completed && { backgroundColor: config.color, borderColor: config.color },
      ]}>
        {log.completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[
        styles.taskLabel,
        log.completed && styles.taskLabelCompleted,
      ]}>
        {log.task_label}
      </Text>
      <Text style={[
        styles.taskPts,
        { color: log.completed ? config.color : Colors.textTertiary },
      ]}>
        {log.completed ? `+${log.pts_earned}` : `+${log.pts_possible}`}
      </Text>
    </Pressable>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 26,
    color: Colors.textPrimary,
  },
  headerPts: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 15,
  },
  headerPtsEarned: {
    color: Colors.scoreGold,
  },
  headerPtsTotal: {
    color: Colors.textSecondary,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: Colors.bgHighest,
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: Colors.scoreGold,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  sectionPts: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: Colors.bgPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  taskLabel: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  taskLabelCompleted: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  taskPts: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 14,
  },
  // Quick Add
  quickAddBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.bgHighest,
    gap: 6,
  },
  quickAddButtonPlus: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    color: Colors.stackTeal,
  },
  quickAddButtonText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  quickAddContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
    gap: 10,
  },
  quickAddInput: {
    flex: 1,
    backgroundColor: Colors.bgHighest,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.stackTealBorder,
  },
  quickAddSend: {
    backgroundColor: Colors.stackTeal,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddSendDisabled: {
    opacity: 0.4,
  },
  quickAddSendText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  quickAddCancel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  // Empty state
  emptyTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: Colors.protocolPurple,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyButtonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
})
