import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
import { Colors, TaskConfig } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useStandup } from '@/hooks/useStandup'
import { useProtocolItems } from '@/hooks/useProtocolItems'
import { useDailyLog } from '@/hooks/useDailyLog'
import { buildStandupPrompt, parseCapture } from '@/lib/system-prompt'
import { ChatMessage, CapturedItem } from '@/types'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StandupModal() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [carryForward, setCarryForward] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const date = todayISO()

  // Load user + carry forward
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
      if (profile?.name) setUserName(profile.name)

      // Get last close session's carry_forward
      const { data: lastClose } = await supabase
        .from('standup_sessions')
        .select('carry_forward')
        .eq('user_id', user.id)
        .eq('session_type', 'close')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (lastClose?.carry_forward) setCarryForward(lastClose.carry_forward)
    }
    load()
  }, [])

  const { items: protocolItems, loading: itemsLoading } = useProtocolItems(userId ?? '')
  const { seedFromStandup } = useDailyLog(userId ?? '', date)

  const systemPrompt = useMemo(() => {
    if (!protocolItems.length) return ''
    return buildStandupPrompt(userName, protocolItems, carryForward)
  }, [userName, protocolItems, carryForward])

  const { state, sendMessage } = useStandup(systemPrompt)
  const [input, setInput] = useState('')

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
  }, [])

  useEffect(() => { scrollToEnd() }, [state.messages])

  // Strip CAPTURE block from message text for display
  function displayText(raw: string): string {
    const idx = raw.lastIndexOf('CAPTURE:')
    return idx !== -1 ? raw.substring(0, idx).trim() : raw.trim()
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || state.isLoading) return
    setInput('')
    await sendMessage(text)
  }

  async function handleFinish() {
    if (!userId || seeding) return
    setSeeding(true)

    console.log('[standup] === FINISH TAPPED ===')
    console.log('[standup] userId:', userId)
    console.log('[standup] date:', date)
    console.log('[standup] capturedItems:', JSON.stringify(state.capturedItems, null, 2))
    console.log('[standup] protocolItems:', protocolItems.map(i => ({ id: i.id, label: i.label })))

    // Build stack/stretch from capturedItems
    let stackItems = state.capturedItems
      .filter(i => i.type === 'stack')
      .map(i => ({ label: i.label }))
    let stretchItems = state.capturedItems
      .filter(i => i.type === 'stretch')
      .map(i => ({ label: i.label }))

    // Fallback: if CAPTURE parsing failed, parse items from the summary message text
    if (stackItems.length === 0 && stretchItems.length === 0) {
      console.log('[standup] capturedItems empty — parsing summary text as fallback')
      const lastAssistant = [...state.messages].reverse().find(m => m.role === 'assistant')
      if (lastAssistant) {
        const text = lastAssistant.content
        console.log('[standup] last assistant message:', text.substring(0, 300))
        const parsed = parseSummaryText(text)
        stackItems = parsed.stack
        stretchItems = parsed.stretch
        console.log('[standup] fallback parsed stack:', stackItems)
        console.log('[standup] fallback parsed stretch:', stretchItems)
      }
    }

    console.log('[standup] final stackItems:', stackItems)
    console.log('[standup] final stretchItems:', stretchItems)

    // Save session
    const { error: sessionError } = await supabase.from('standup_sessions').insert({
      user_id: userId,
      date,
      session_type: 'standup',
      mode: 'chat',
      messages: state.messages,
      duration_sec: 0,
    })
    if (sessionError) console.error('[standup] session insert error:', sessionError)

    // Seed daily logs
    const { error: seedError } = await seedFromStandup(protocolItems, stackItems, stretchItems)
    if (seedError) console.error('[standup] seedFromStandup error:', seedError)
    else console.log('[standup] seedFromStandup success')

    setSeeding(false)
    router.replace('/(tabs)/today')
  }

  // Fallback parser: extract stack/stretch items from the summary message text
  // when CAPTURE JSON parsing fails
  function parseSummaryText(text: string): {
    stack: Array<{ label: string }>
    stretch: Array<{ label: string }>
  } {
    const stack: Array<{ label: string }> = []
    const stretch: Array<{ label: string }> = []

    const lines = text.split('\n')
    let currentSection: 'protocol' | 'stack' | 'stretch' | null = null

    for (const line of lines) {
      const lower = line.toLowerCase()
      if (lower.includes('**protocol**') || lower.includes('protocol (')) {
        currentSection = 'protocol'
      } else if (lower.includes('**stack**')) {
        currentSection = 'stack'
      } else if (lower.includes('**stretch**') || lower.includes('stretch ★')) {
        currentSection = 'stretch'
      } else if (lower.startsWith('potential:')) {
        currentSection = null
      } else if (currentSection && (line.trim().startsWith('-') || line.trim().startsWith('•'))) {
        // Extract label: strip bullet, strip trailing +N points
        const label = line.trim()
          .replace(/^[-•]\s*/, '')
          .replace(/\s*\+\d+\s*$/, '')
          .trim()
        if (label && currentSection === 'stack') {
          stack.push({ label })
        } else if (label && currentSection === 'stretch') {
          stretch.push({ label })
        }
        // Skip protocol items — they come from protocolItems array
      }
    }

    return { stack, stretch }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === 'user'
    const text = isUser ? item.content : displayText(item.content)
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    )
  }

  function renderCaptureItem(item: CapturedItem, index: number) {
    const config = TaskConfig[item.type]
    return (
      <View key={index} style={[styles.captureItem, { backgroundColor: config.bg, borderColor: config.border }]}>
        <View style={[styles.captureDot, { backgroundColor: config.color }]} />
        <Text style={styles.captureLabel}>{item.label}</Text>
        <Text style={[styles.capturePts, { color: config.color }]}>+{item.pts}</Text>
      </View>
    )
  }

  if (!userId || itemsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.protocolPurple} size="large" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Morning Standup</Text>
        <View style={styles.closeBtn} />
      </View>

      {/* Capture sidebar (horizontal strip above chat when items exist) */}
      {state.capturedItems.length > 0 && (
        <View style={styles.captureStrip}>
          {state.capturedItems.map(renderCaptureItem)}
        </View>
      )}

      {/* Chat */}
      <FlatList
        ref={flatListRef}
        data={state.messages}
        renderItem={renderMessage}
        keyExtractor={(_, i) => String(i)}
        style={styles.chatList}
        contentContainerStyle={styles.chatContent}
        ListFooterComponent={
          state.error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{state.error}</Text>
            </View>
          ) : null
        }
      />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Persistent finish button — always available */}
        <Pressable
          style={[
            styles.finishButton,
            state.isComplete && styles.finishButtonProminent,
            seeding && styles.finishButtonDisabled,
          ]}
          onPress={handleFinish}
          disabled={seeding}
        >
          {seeding ? (
            <ActivityIndicator color={state.isComplete ? Colors.bgPrimary : Colors.scoreGold} size="small" />
          ) : (
            <Text style={[
              styles.finishButtonText,
              state.isComplete && styles.finishButtonTextProminent,
            ]}>
              {state.isComplete ? 'Start the day' : 'Finish & start the day'}
            </Text>
          )}
        </Pressable>

        {/* Input row — hidden once summary is delivered */}
        {!state.isComplete && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Say something..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={500}
              editable={!state.isLoading}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendButton, (!input.trim() || state.isLoading) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || state.isLoading}
            >
              {state.isLoading ? (
                <ActivityIndicator color={Colors.textPrimary} size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
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
    borderBottomColor: Colors.border,
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
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  captureStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  captureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 8,
  },
  captureDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  captureLabel: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  capturePts: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
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
    backgroundColor: Colors.bgSurface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
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
  bottomBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.protocolPurple,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  finishButton: {
    backgroundColor: Colors.bgHighest,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.scoreGoldBorder,
  },
  finishButtonProminent: {
    backgroundColor: Colors.scoreGold,
    borderColor: Colors.scoreGold,
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: Colors.scoreGold,
  },
  finishButtonTextProminent: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: Colors.bgPrimary,
  },
})
