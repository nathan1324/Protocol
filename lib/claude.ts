import { supabase } from './supabase'
import { ChatMessage } from '@/types'
import { parseCapture, parseClose, parseProtocol, isStandupComplete, isCloseComplete, isOnboardingComplete } from './system-prompt'

// ─── Types ────────────────────────────────────────────────────────────────

interface StandupChunkHandler {
  onToken: (token: string) => void
  onCapture: (items: Array<{ type: 'protocol' | 'stack' | 'stretch'; label: string; pts: number }>) => void
  onComplete: (fullText: string, isStandupDone: boolean) => void
  onError: (error: string) => void
}

interface CloseChunkHandler {
  onToken: (token: string) => void
  onComplete: (fullText: string, closeData: { energy: string; carry_forward: string; reflection: string } | null) => void
  onError: (error: string) => void
}

// ─── Standup Chat ─────────────────────────────────────────────────────────
// Routes through Supabase Edge Function 'standup-chat'
// which holds the Anthropic API key server-side

export async function sendStandupMessage(
  messages: ChatMessage[],
  systemPrompt: string,
  handlers: StandupChunkHandler
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('standup-chat', {
      body: {
        messages,
        system: systemPrompt,
        session_type: 'standup',
      },
    })

    if (error) throw new Error(error.message)

    const rawResponse: string = data?.content ?? ''
    const { text, items } = parseCapture(rawResponse)
    const complete = isStandupComplete(text)

    // Stream tokens character by character for feel
    // (In production, implement true streaming via SSE from Edge Function)
    for (const char of text) {
      handlers.onToken(char)
      await sleep(8)
    }

    if (items.length > 0) {
      handlers.onCapture(items)
    }

    handlers.onComplete(rawResponse, complete)
  } catch (err) {
    handlers.onError(
      err instanceof Error ? err.message : 'Connection error. Try again.'
    )
  }
}

// ─── Evening Close ────────────────────────────────────────────────────────

export async function sendCloseMessage(
  messages: ChatMessage[],
  systemPrompt: string,
  handlers: CloseChunkHandler
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('standup-chat', {
      body: {
        messages,
        system: systemPrompt,
        session_type: 'close',
      },
    })

    if (error) throw new Error(error.message)

    const rawResponse: string = data?.content ?? ''
    const { text, closeData } = parseClose(rawResponse)
    const complete = isCloseComplete(text)

    for (const char of text) {
      handlers.onToken(char)
      await sleep(8)
    }

    if (complete) {
      handlers.onComplete(rawResponse, closeData)
    } else {
      handlers.onComplete(rawResponse, null)
    }
  } catch (err) {
    handlers.onError(
      err instanceof Error ? err.message : 'Connection error. Try again.'
    )
  }
}

// ─── Onboarding Chat ─────────────────────────────────────────────────────

interface OnboardingChunkHandler {
  onToken: (token: string) => void
  onComplete: (fullText: string, items: Array<{ label: string; category: string }> | null) => void
  onError: (error: string) => void
}

export async function sendOnboardingMessage(
  messages: ChatMessage[],
  systemPrompt: string,
  handlers: OnboardingChunkHandler
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('standup-chat', {
      body: {
        messages,
        system: systemPrompt,
        session_type: 'onboarding',
      },
    })

    if (error) throw new Error(error.message)

    const rawResponse: string = data?.content ?? ''
    const { text, items } = parseProtocol(rawResponse)

    for (const char of text) {
      handlers.onToken(char)
      await sleep(8)
    }

    handlers.onComplete(rawResponse, items)
  } catch (err) {
    handlers.onError(
      err instanceof Error ? err.message : 'Connection error. Try again.'
    )
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
