import { useState, useRef, useCallback, useEffect } from 'react'
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
import { sendOnboardingMessage } from '@/lib/claude'
import { buildOnboardingPrompt } from '@/lib/system-prompt'
import { ChatMessage, ProtocolCategory } from '@/types'

const OPENING_LINE =
  "Welcome to Protocol. Let's figure out what your best day looks like — walk me through it starting from when you wake up."

interface ProposedItem {
  label: string
  category: string
}

export default function OnboardingScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: OPENING_LINE },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [proposedItems, setProposedItems] = useState<ProposedItem[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const flatListRef = useRef<FlatList>(null)

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
  }, [])

  useEffect(() => { scrollToEnd() }, [messages, streamingText])

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)
    setStreamingText('')

    // Build API messages (skip the hardcoded opening for the system prompt)
    const apiMessages = updatedMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const systemPrompt = buildOnboardingPrompt('')

    await sendOnboardingMessage(apiMessages, systemPrompt, {
      onToken(token) {
        setStreamingText(prev => prev + token)
        scrollToEnd()
      },
      onComplete(fullText, items) {
        // Parse the display text (without PROTOCOL: block)
        const protocolIdx = fullText.lastIndexOf('PROTOCOL:')
        const displayText = protocolIdx !== -1
          ? fullText.substring(0, protocolIdx).trim()
          : fullText.trim()

        setMessages(prev => [...prev, { role: 'assistant', content: displayText }])
        setStreamingText('')
        setIsLoading(false)

        if (items && items.length > 0) {
          setProposedItems(items)
        }
      },
      onError(errorMsg) {
        setError(errorMsg)
        setStreamingText('')
        setIsLoading(false)
      },
    })
  }

  async function handleConfirmProtocol() {
    if (!proposedItems) return
    setIsSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const allDays = [0, 1, 2, 3, 4, 5, 6]
      const rows = proposedItems.map((item, i) => ({
        user_id: user.id,
        label: item.label,
        category: item.category as ProtocolCategory,
        active_days: allDays,
        source: 'onboarding' as const,
        sort_order: i,
        active: true,
      }))

      const { error: insertError } = await supabase
        .from('protocol_items')
        .insert(rows)

      if (insertError) throw insertError

      // Mark user as onboarded
      await supabase
        .from('users')
        .update({ onboarded: true })
        .eq('id', user.id)

      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save protocol')
    } finally {
      setIsSaving(false)
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
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
        <Text style={styles.headerTitle}>Set up your protocol</Text>
        <Text style={styles.headerSub}>The 3-6 daily items that define your best day</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, i) => String(i)}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        ListFooterComponent={
          <>
            {streamingText ? (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <Text style={styles.messageText}>{streamingText}</Text>
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

      {proposedItems ? (
        <View style={styles.confirmContainer}>
          <View style={styles.itemsList}>
            {proposedItems.map((item, i) => (
              <View key={i} style={styles.proposedItem}>
                <View style={styles.itemDot} />
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={[styles.confirmButton, isSaving && styles.confirmButtonDisabled]}
            onPress={handleConfirmProtocol}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.bgPrimary} size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>Lock it in</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Describe your day..."
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
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
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
  messageText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  userText: {
    color: Colors.textPrimary,
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
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
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
  confirmContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  itemsList: {
    gap: 10,
    marginBottom: 16,
  },
  proposedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.protocolPurpleBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Colors.protocolPurpleBorder,
    gap: 10,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.protocolPurple,
  },
  itemLabel: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  itemCategory: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  confirmButton: {
    backgroundColor: Colors.protocolPurple,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
})
