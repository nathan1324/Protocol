import { useState, useCallback, useRef } from 'react'
import { ChatMessage, StandupState, CapturedItem } from '@/types'
import { sendStandupMessage } from '@/lib/claude'

const OPENING_LINE = "Morning. What moved yesterday — anything worth crediting before we build today?"

const FORCE_SUMMARY_DIRECTIVE = `

EXCHANGE LIMIT REACHED. OUTPUT THE FINAL SUMMARY NOW USING EXACTLY THIS FORMAT AND NO OTHER FORMAT:

Here's your day, [name]:

**Protocol** (auto-loaded):
- [item] +1

**Stack**:
- [item] +2

**Stretch** ★:
- [item] +3

Potential: [X] pts. [One sentence.]

CAPTURE:{...}

DO NOT USE HEADERS. DO NOT USE ## MARKDOWN. USE ONLY THE FORMAT ABOVE.`

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
    const userMessage: ChatMessage = { role: 'user', content: userText }
    const newMessages = [...state.messages, userMessage]
    setState(prev => ({ ...prev, messages: newMessages, isLoading: true, error: null }))

    // After the user's 3rd message, force the LLM to summarize
    const prompt = userMessageCount.current >= 3
      ? systemPrompt + FORCE_SUMMARY_DIRECTIVE
      : systemPrompt

    let streamed = ''
    await sendStandupMessage(newMessages, prompt, {
      onToken: (t) => { streamed += t; setState(prev => ({ ...prev, messages: [...newMessages, { role: 'assistant', content: streamed }] })) },
      onCapture: (items: CapturedItem[]) => { setState(prev => ({ ...prev, capturedItems: [...prev.capturedItems, ...items] })) },
      onComplete: (full, done) => { setState(prev => ({ ...prev, messages: [...newMessages, { role: 'assistant', content: full }], isLoading: false, isComplete: done })) },
      onError: (err) => { setState(prev => ({ ...prev, isLoading: false, error: err })) },
    })
  }, [state.messages, systemPrompt])

  const reset = useCallback(() => {
    userMessageCount.current = 0
    setState({ messages: [{ role: 'assistant', content: OPENING_LINE }], capturedItems: [], isLoading: false, isComplete: false, output: null, error: null })
  }, [])

  return { state, sendMessage, reset, openingLine: OPENING_LINE }
}
