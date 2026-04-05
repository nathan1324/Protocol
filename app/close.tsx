import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { Colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { sendCloseMessage } from '@/lib/claude'
import { buildClosePrompt } from '@/lib/system-prompt'
import { ChatMessage } from '@/types'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface CloseData {
  energy: string
  carry_forward: string
  reflection: string
}

interface TaskEntry {
  label: string
  type: string
  acknowledged: boolean
}

export default function CloseModal() {
  const [userId, setUserId] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [taskEntries, setTaskEntries] = useState<TaskEntry[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [closeData, setCloseData] = useState<CloseData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const date = todayISO()

  type LogEntry = {
    task_label: string
    task_type: string
    completed: boolean
    pts_earned: number
    pts_possible: number
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single()
      const userName = profile?.name || ''

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('task_label, task_type, completed, pts_earned, pts_possible')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: true })

      const taskList = (logs || []) as LogEntry[]

      // Build task entries for the living receipt
      setTaskEntries(taskList.map(l => ({
        label: l.task_label,
        type: l.task_type,
        acknowledged: false,
      })))

      const todaySummary = buildTodaySummary(taskList)
      setSystemPrompt(buildClosePrompt(userName, todaySummary))

      // Opening message is just the intro — the task list renders separately
      const intro = taskList.length > 0
        ? `The day is done. You had ${taskList.length} things on your list. What actually happened?`
        : 'The day is done. What actually happened?'
      setMessages([{ role: 'assistant', content: intro }])
      setReady(true)
    }
    load()
  }, [])

  function buildTodaySummary(logs: LogEntry[]): string {
    if (logs.length === 0) return '(No tasks logged today.)'

    const completed = logs.filter(l => l.completed)
    const incomplete = logs.filter(l => !l.completed)
    const earned = logs.reduce((s, l) => s + l.pts_earned, 0)
    const potential = logs.reduce((s, l) => s + l.pts_possible, 0)

    let summary = `Score: ${earned}/${potential} pts.\n`
    summary += `${completed.length} of ${logs.length} tasks completed.\n\n`

    if (completed.length > 0) {
      summary += 'COMPLETED:\n' + completed.map(l =>
        `- [done] ${l.task_label} (${l.task_type}, +${l.pts_earned})`
      ).join('\n')
    }
    if (incomplete.length > 0) {
      summary += '\n\nNOT COMPLETED:\n' + incomplete.map(l =>
        `- [missed] ${l.task_label} (${l.task_type}, 0/${l.pts_possible} pts)`
      ).join('\n')
    }
    return summary
  }

  // Scan conversation for task mentions and mark them acknowledged
  function updateAcknowledged(allMessages: ChatMessage[]) {
    const conversationText = allMessages
      .map(m => m.content.toLowerCase())
      .join(' ')

    setTaskEntries(prev => prev.map(entry => {
      if (entry.acknowledged) return entry
      // Check if the task label (or significant portion) appears in conversation
      const words = entry.label.toLowerCase().split(/\s+/)
      const significantWords = words.filter(w => w.length > 3)
      const matched = significantWords.length > 0
        ? significantWords.some(word => conversationText.includes(word))
        : conversationText.includes(entry.label.toLowerCase())
      return matched ? { ...entry, acknowledged: true } : entry
    }))
  }

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
  }, [])

  useEffect(() => { scrollToEnd() }, [messages, streamingText])

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading || !systemPrompt) return

    setInput('')
    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)
    setStreamingText('')

    // Mark tasks acknowledged from user's message
    updateAcknowledged(updatedMessages)

    await sendCloseMessage(updatedMessages, systemPrompt, {
      onToken(token) {
        setStreamingText(prev => prev + token)
        scrollToEnd()
      },
      onComplete(fullText, data) {
        const closeIdx = fullText.lastIndexOf('CLOSE:')
        const displayText = closeIdx !== -1
          ? fullText.substring(0, closeIdx).trim()
          : fullText.trim()

        const newMessages = [...updatedMessages, { role: 'assistant', content: displayText }]
        setMessages(newMessages)
        setStreamingText('')
        setIsLoading(false)

        // Mark tasks acknowledged from LLM's response too
        updateAcknowledged(newMessages)

        if (data) {
          setCloseData(data as CloseData)
        }
      },
      onError(errorMsg) {
        setError(errorMsg)
        setStreamingText('')
        setIsLoading(false)
      },
    })
  }

  async function handleDismiss() {
    if (!userId || isSaving) return
    setIsSaving(true)

    await supabase.from('standup_sessions').insert({
      user_id: userId,
      date,
      session_type: 'close',
      mode: 'chat',
      messages,
      energy_signal: closeData?.energy || null,
      carry_forward: closeData?.carry_forward || null,
      duration_sec: 0,
    })

    setIsSaving(false)
    router.replace('/(tabs)')
  }

  // End screen — journal closed
  if (closeData) {
    return (
      <View style={styles.endScreen}>
        <Text style={styles.endReflection}>{closeData.reflection}</Text>
        <View style={styles.endDivider} />
        <Text style={styles.endEnergy}>{closeData.energy} energy</Text>
        {closeData.carry_forward && (
          <Text style={styles.endCarry}>Carrying forward: {closeData.carry_forward}</Text>
        )}
        <Pressable
          style={[styles.goodnightButton, isSaving && styles.goodnightButtonDisabled]}
          onPress={handleDismiss}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <Text style={styles.goodnightText}>Goodnight</Text>
          )}
        </Pressable>
      </View>
    )
  }

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.textSecondary} size="large" />
      </View>
    )
  }

  const typeColor: Record<string, string> = {
    protocol: Colors.protocolPurple,
    stack: Colors.stackTeal,
    stretch: Colors.stretchAmber,
  }

  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
    const isUser = item.role === 'user'
    const isFirst = index === 0 && !isUser

    // First assistant message gets the living task receipt
    if (isFirst && taskEntries.length > 0) {
      return (
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Text style={styles.bubbleText}>{item.content}</Text>
          <View style={styles.receiptList}>
            {taskEntries.map((entry, i) => (
              <View key={i} style={styles.receiptRow}>
                <View style={[
                  styles.receiptDot,
                  { backgroundColor: typeColor[entry.type] || Colors.textTertiary },
                  entry.acknowledged && styles.receiptDotAck,
                ]} />
                <Text style={[
                  styles.receiptLabel,
                  entry.acknowledged && styles.receiptLabelAck,
                ]}>
                  {entry.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )
    }

    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={styles.bubbleText}>{item.content}</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Evening Close</Text>
        <View style={styles.closeBtn} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, i) => String(i)}
        style={styles.chatList}
        contentContainerStyle={styles.chatContent}
        extraData={taskEntries}
        ListFooterComponent={
          <>
            {streamingText ? (
              <View style={[styles.bubble, styles.assistantBubble]}>
                <Text style={styles.bubbleText}>{streamingText}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Reflect..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={500}
          editable={!isLoading}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0D',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  closeBtn: {
    width: 60,
  },
  closeBtnText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.bgHighest,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#111114',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  bubbleText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 23,
  },

  // Living task receipt
  receiptList: {
    marginTop: 12,
    gap: 7,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  receiptDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  receiptDotAck: {
    opacity: 0.3,
  },
  receiptLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  receiptLabelAck: {
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },

  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    backgroundColor: '#0A0A0D',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.bgHighest,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  sendButton: {
    backgroundColor: Colors.textSecondary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendButtonText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: Colors.bgPrimary,
  },

  // End screen
  endScreen: {
    flex: 1,
    backgroundColor: '#0A0A0D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  endReflection: {
    fontFamily: 'Lora_400Regular',
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
  },
  endDivider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.textTertiary,
    marginVertical: 24,
  },
  endEnergy: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'lowercase',
    marginBottom: 8,
  },
  endCarry: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 32,
  },
  goodnightButton: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  goodnightButtonDisabled: {
    opacity: 0.5,
  },
  goodnightText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: Colors.textSecondary,
  },
})
