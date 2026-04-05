import { useState, useCallback } from 'react'
import { ChatMessage, StandupState, CapturedItem } from '@/types'
import { sendStandupMessage } from '@/lib/claude'

const OPENING_LINE = "Morning. What moved yesterday — anything worth crediting before we build today?"

export function useStandup(systemPrompt: string) {
  const [state, setState] = useState<StandupState>({
    messages: [{ role: 'assistant', content: OPENING_LINE }],
    capturedItems: [],
    isLoading: false,
    isComplete: false,
    output: null,
    error: null,
  })

  const sendMessage = useCallback(async (userText: string) => {
    const userMessage: ChatMessage = { role: 'user', content: userText }
    const newMessages = [...state.messages, userMessage]
    setState(prev => ({ ...prev, messages: newMessages, isLoading: true, error: null }))
    let streamed = ''
    await sendStandupMessage(newMessages, systemPrompt, {
      onToken: (t) => { streamed += t; setState(prev => ({ ...prev, messages: [...newMessages, { role: 'assistant', content: streamed }] })) },
      onCapture: (items: CapturedItem[]) => { setState(prev => ({ ...prev, capturedItems: [...prev.capturedItems, ...items] })) },
      onComplete: (full, done) => { setState(prev => ({ ...prev, messages: [...newMessages, { role: 'assistant', content: full }], isLoading: false, isComplete: done })) },
      onError: (err) => { setState(prev => ({ ...prev, isLoading: false, error: err })) },
    })
  }, [state.messages, systemPrompt])

  const reset = useCallback(() => {
    setState({ messages: [{ role: 'assistant', content: OPENING_LINE }], capturedItems: [], isLoading: false, isComplete: false, output: null, error: null })
  }, [])

  return { state, sendMessage, reset, openingLine: OPENING_LINE }
}
