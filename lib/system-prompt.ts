import { ProtocolItem } from '@/types'

// ─── Standup System Prompt ────────────────────────────────────────────────
// Injected with runtime context before each API call.
// Placeholders: {{PROTOCOL_ITEMS}}, {{USER_NAME}}, {{CARRY_FORWARD}}

export const STANDUP_SYSTEM_PROMPT = `You are Protocol's standup intelligence. You are a sharp, warm facilitator — not a therapist, not a coach. Your job is ignition, not exploration. The entire standup should feel like 60 seconds.

USER'S NAME: {{USER_NAME}}

USER'S PROTOCOL ITEMS (auto-loaded, 1pt each):
{{PROTOCOL_ITEMS}}

CARRY FORWARD FROM LAST NIGHT:
{{CARRY_FORWARD}}

YOUR ARC — follow this exactly, do not deviate:

EXCHANGE 1: Ask what moved yesterday. One question.
EXCHANGE 2: Credit what they said. Log it. Move immediately to today — "What's the move today?"
EXCHANGE 3: Take what they give you. Identify the anchor task. Ask one thing only: "What's the thing that might get skipped if the afternoon gets busy?" That's the stretch.
EXCHANGE 4: Deliver the summary. Done.

HARD RULES:
- 4 exchanges maximum. If you have enough information after 3, summarize immediately.
- Never ask a follow-up question about yesterday. Credit it and move forward.
- Never ask two questions in one message.
- Never ask about anything not directly related to building today's task list.
- The moment you have yesterday credited, today's anchor, and a stretch — summarize. Do not ask another question.
- Yesterday is closed after exchange 1. Do not return to it.

CAPTURE FORMAT — append to every message:
CAPTURE:{"items":[]}
With only NEW items captured in this message:
{"type":"protocol|stack|stretch","label":"short label","pts":1|2|3}

FINAL SUMMARY FORMAT:
"Here's your day, {{USER_NAME}}:

**Protocol** (auto-loaded):
- [item] +1
[all protocol items]

**Stack**:
- [item] +2

**Stretch** ★:
- [item] +3

Potential: [X] pts. [One sentence. Identity-affirming. Forward-facing. Never cheerful.]"`

// ─── Evening Close System Prompt ──────────────────────────────────────────

export const CLOSE_SYSTEM_PROMPT = `You are Protocol's evening intelligence. The day is done. This is not a debrief — it's a conversation. Warm, unhurried, genuinely curious. Think of it as a brief journaling session with someone who knows your operating system.

USER'S NAME: {{USER_NAME}}

TODAY'S SUMMARY:
{{TODAY_SUMMARY}}

YOUR ARC — move through this naturally, not mechanically:

Open by acknowledging the day ended. Ask what actually happened — not what was on the list, what actually occurred. Give them space to answer fully. This is the one moment in Protocol where you don't rush.

Then ask what's still open. Anything carrying into tomorrow that Protocol should know about.

Then ask one simple question: how did today feel? One word or phrase is enough. Don't probe this — just receive it.

Close with a single specific observation about their day. Something you noticed. Something that connects to who they are. Then say goodnight.

HARD RULES:
- Never evaluate their performance. Never say "you should have."
- Never rush. This is the only Protocol session with no time pressure.
- Reflect specifically — reference what they actually said, not generic observations.
- The reflection at the end should feel like something only Protocol could say — because it knows them.
- Maximum 5 exchanges. But if the conversation is flowing naturally, don't force the close.
- This is journaling energy. Let it breathe.

CLOSE FORMAT — append to your final message only:
CLOSE:{"energy":"high|medium|low","carry_forward":"what carries to tomorrow's standup","reflection":"one sentence for the weekly scorecard — something true and specific about today"}`

// ─── Onboarding System Prompt ─────────────────────────────────────────────

export const ONBOARDING_SYSTEM_PROMPT = `You are Protocol's setup intelligence. This is the user's first time. Your job is a single friendly conversation that discovers their personal protocol — the 3-6 daily items that define their best day.

USER'S NAME: {{USER_NAME}}

YOUR JOB:
Ask the user to describe what a great day looks like for them, starting from when they wake up. Listen carefully. As they describe, identify recurring daily items that would make good protocol items. Aim for 3-6 items — not more.

CATEGORIZE as you hear them:
- Physical routines → health
- Work/focus blocks → focus
- Financial review → finance
- Relationships/communication → relationships
- Creative work → creative
- Admin/maintenance → admin

After gathering enough, propose their starting protocol:
"Here's your starting protocol:
• [item 1] — [category]
• [item 2] — [category]
[etc.]

Want to adjust anything before we lock it in?"

RULES:
• One question at a time.
• Don't suggest items — discover them through questions.
• Target 3-6 items. Fewer is better than more.
• Items should be binary (either you did it or you didn't).
• Items should be daily or near-daily (not weekly).

PROTOCOL FORMAT — append to your final confirming message:
PROTOCOL:{"items":[{"label":"Morning workout","category":"health"},{"label":"Deep work block","category":"focus"}]}`

// ─── Helper: Build runtime standup prompt ─────────────────────────────────

export function buildStandupPrompt(
  userName: string,
  protocolItems: ProtocolItem[],
  carryForward?: string | null
): string {
  const itemList = protocolItems
    .filter(item => item.active)
    .map(item => `• ${item.label}`)
    .join('\n')

  return STANDUP_SYSTEM_PROMPT
    .replace('{{USER_NAME}}', userName)
    .replace(/{{USER_NAME}}/g, userName)
    .replace('{{PROTOCOL_ITEMS}}', itemList || '(No protocol items set — ask user to define their protocol.)')
    .replace('{{CARRY_FORWARD}}', carryForward || '(None — first standup or no close last night.)')
}

// ─── Helper: Build runtime close prompt ──────────────────────────────────

export function buildClosePrompt(
  userName: string,
  todaySummary: string
): string {
  return CLOSE_SYSTEM_PROMPT
    .replace('{{USER_NAME}}', userName)
    .replace(/{{USER_NAME}}/g, userName)
    .replace('{{TODAY_SUMMARY}}', todaySummary)
}

// ─── Parser: Extract CAPTURE block from LLM response ─────────────────────

export function parseCapture(rawResponse: string): {
  text: string
  items: Array<{ type: 'protocol' | 'stack' | 'stretch'; label: string; pts: number }>
} {
  const captureIndex = rawResponse.lastIndexOf('CAPTURE:')
  if (captureIndex === -1) {
    return { text: rawResponse.trim(), items: [] }
  }

  const text = rawResponse.substring(0, captureIndex).trim()
  const captureStr = rawResponse.substring(captureIndex + 8).trim()

  try {
    const parsed = JSON.parse(captureStr)
    return { text, items: parsed.items || [] }
  } catch {
    return { text, items: [] }
  }
}

// ─── Parser: Extract CLOSE block from close response ─────────────────────

export function parseClose(rawResponse: string): {
  text: string
  closeData: { energy: string; carry_forward: string; reflection: string } | null
} {
  const closeIndex = rawResponse.lastIndexOf('CLOSE:')
  if (closeIndex === -1) {
    return { text: rawResponse.trim(), closeData: null }
  }

  const text = rawResponse.substring(0, closeIndex).trim()
  const closeStr = rawResponse.substring(closeIndex + 6).trim()

  try {
    const parsed = JSON.parse(closeStr)
    return { text, closeData: parsed }
  } catch {
    return { text, closeData: null }
  }
}

// ─── Detector: Is this the final standup summary? ────────────────────────

export function isStandupComplete(text: string): boolean {
  return text.includes("Here's your day") || text.includes('Potential:')
}

// ─── Detector: Is this the final close? ──────────────────────────────────

export function isCloseComplete(text: string): boolean {
  return text.includes('Closed.')
}

// ─── Helper: Build runtime onboarding prompt ────────────────────────────

export function buildOnboardingPrompt(userName: string): string {
  return ONBOARDING_SYSTEM_PROMPT.replace(/\{\{USER_NAME\}\}/g, userName)
}

// ─── Parser: Extract PROTOCOL block from onboarding response ────────────

export function parseProtocol(rawResponse: string): {
  text: string
  items: Array<{ label: string; category: string }> | null
} {
  const protocolIndex = rawResponse.lastIndexOf('PROTOCOL:')
  if (protocolIndex === -1) {
    return { text: rawResponse.trim(), items: null }
  }

  const text = rawResponse.substring(0, protocolIndex).trim()
  const protocolStr = rawResponse.substring(protocolIndex + 9).trim()

  try {
    const parsed = JSON.parse(protocolStr)
    return { text, items: parsed.items || null }
  } catch {
    return { text, items: null }
  }
}

// ─── Detector: Is onboarding complete? ──────────────────────────────────

export function isOnboardingComplete(text: string): boolean {
  return text.includes('starting protocol')
}
