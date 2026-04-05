import { useState, useCallback, useRef } from 'react'
import { ChatMessage, StandupState, CapturedItem } from '@/types'
import { sendStandupMessage } from '@/lib/claude'

const OPENING_LINE = "Morning. What moved yesterday — anything worth crediting before we build today?"

const FORCE_SUMMARY_DIRECTIVE = `

FINAL EXCHANGE. Deliver the summary now using the exact FINAL SUMMARY FORMAT. No more questions.

Here's your day, [name]:

**Protocol** (auto-loaded):
- [item] +1

**Stack**:
- [item] +2

**Stretch** ★:
- [item] +3

Potential: [X] pts. [One sentence.]

CAPTURE:{"items":[...all items captured during this standup...]}

DO NOT USE HEADERS. DO NOT USE ## MARKDOWN. USE ONLY THE FORMAT ABOVE. THIS IS NON-NEGOTIABLE.`

export function useStandup(systemPrompt: string) {
  const [state, setState] = useState<StandupState>({
    messages: [{ role: 'assistant', content: OPENING_LINE }],
    capturedItems: [],
    isLoading: false,
    isComplete: false,
    output: null,
    error: null,
  })
  const userMessageCount = useRef(0)

  const sendMessage = useCallback(async (userText: string) => {
    userMessageCount.current += 1
    const count = userMessageCount.current
    const userMessage: ChatMessage = { role: 'user', content: userText }
    const newMessages = [...state.messages, userMessage]
    setState(prev => ({ ...prev, messages: newMessages, isLoading: true, error: null }))

    // After the user's 3rd message, force the LLM to summarize
    const prompt = count >= 3
      ? systemPrompt + FORCE_SUMMARY_DIRECTIVE
      : systemPrompt

    let streamed = ''
    await sendStandupMessage(newMessages, prompt, {
      onToken: (t) => { streamed += t; setState(prev => ({ ...prev, messages: [...newMessages, { role: 'assistant', content: streamed }] })) },
      onCapture: (items: CapturedItem[]) => { setState(prev => ({ ...prev, capturedItems: [...prev.capturedItems, ...items] })) },
      onComplete: (full, done) => {
        // Force complete after 3rd exchange regardless of LLM output
        const forceComplete = count >= 3
        setState(prev => ({
          ...prev,
          messages: [...newMessages, { role: 'assistant', content: full }],
          isLoading: false,
          isComplete: done || forceComplete,
        }))
      },
      onError: (err) => { setState(prev => ({ ...prev, isLoading: false, error: err })) },
    })
  }, [state.messages, systemPrompt])

  const reset = useCallback(() => {
    userMessageCount.current = 0
    setState({ messages: [{ role: 'assistant', content: OPENING_LINE }], capturedItems: [], isLoading: false, isComplete: false, output: null, error: null })
  }, [])

  return { state, sendMessage, reset, openingLine: OPENING_LINE }
}
