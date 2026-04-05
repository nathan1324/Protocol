# Protocol — Claude Code Context

You are building **Protocol**, an ambient achievement operating system. This file is your source of truth. Read it fully before touching any code.

---

## What Protocol Is

Protocol is a voice-first daily standup app that rewards the ordinary, remembers your patterns, and scores your week. It is not a to-do app. It is a personal operating system.

**The central insight:** Traditional productivity apps capture the extraordinary (one-off tasks) and ignore the ordinary (the daily baseline that makes every good day possible). Protocol inverts this — it rewards the standard protocol first, then layers achievement on top.

**The positioning:** The Oura ring of achievement. It lives in the background, you forget it's there, and every time you notice it you're grateful. It should never feel like a chore.

---

## The Three Design Laws (Guard Rails for Every Decision)

**I. Ambient over present.**
Every feature is tested against: does this make Protocol more invisible, or more intrusive? Invisible wins unless there is extraordinary justification.

**II. Reflect, never judge.**
The scoring system is a mirror, not a leash. Missed days reset with dignity. Incomplete data defaults to the user's benefit. No shame architecture is non-negotiable.

**III. Identity over outcome.**
Every word Protocol says votes for the identity of the user. Not "you completed 7 tasks" — "you ran a clean protocol today."

---

## Current Build Phase

**Phase 1 — The Ritual** (build this first, nothing else)

The goal of Phase 1 is a working daily habit loop:
1. Morning standup (LLM-powered chat, Claude API)
2. Today view (checkable protocol + stack + stretch items with live point tracking)
3. Evening close (lightweight reflection that seeds tomorrow's standup)
4. Basic weekly score display
5. Manual protocol setup (user defines their 3–6 protocol items)

**Do not build yet:** Memory engine, pattern detection, integrations (Health/Calendar), voice mode, templates, season system. Phase 1 must feel great before Phase 2 is touched.

---

## Architecture Overview

```
protocol/
├── CLAUDE.md                    ← You are here
├── app/                         ← Expo Router screens
│   ├── _layout.tsx              ← Root layout, auth gate
│   ├── (tabs)/
│   │   ├── _layout.tsx          ← Bottom tab navigator
│   │   ├── index.tsx            ← Home screen
│   │   ├── today.tsx            ← Today's protocol view
│   │   ├── score.tsx            ← Weekly score
│   │   └── patterns.tsx         ← Patterns (Phase 3 stub)
│   ├── standup.tsx              ← Morning standup modal
│   ├── close.tsx                ← Evening close modal
│   └── onboarding.tsx           ← First-run protocol setup
├── components/
│   ├── standup/
│   │   ├── StandupChat.tsx      ← LLM conversation UI
│   │   └── CapturePanel.tsx     ← Live item capture sidebar
│   ├── today/
│   │   ├── TaskItem.tsx         ← Single task row (checkable)
│   │   └── SectionHeader.tsx    ← Protocol/Stack/Stretch label
│   ├── score/
│   │   └── WeekChart.tsx        ← Stacked bar chart
│   └── ui/
│       ├── Badge.tsx            ← Pill badges
│       └── Card.tsx             ← Surface card
├── lib/
│   ├── claude.ts                ← Anthropic API client + streaming
│   ├── system-prompt.ts         ← Standup + close LLM system prompts
│   ├── scoring.ts               ← Point calculation engine
│   └── supabase.ts              ← Supabase client
├── hooks/
│   ├── useStandup.ts            ← Standup conversation state
│   ├── useProtocolItems.ts      ← User's protocol items (CRUD)
│   ├── useDailyLog.ts           ← Today's tasks (CRUD + scoring)
│   └── useWeekScore.ts          ← Weekly aggregate score
├── types/index.ts               ← All TypeScript types
├── constants/colors.ts          ← Protocol color system
└── supabase/
    ├── schema.sql               ← Full database schema
    └── migrations/001_initial.sql
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | React Native + Expo SDK 51 | Expo Router for navigation |
| Language | TypeScript (strict) | No `any` types |
| Backend | Supabase | Auth + Postgres + Edge Functions |
| LLM | Anthropic Claude API | claude-sonnet-4-20250514 for standup |
| State | React hooks + Supabase real-time | No Redux/Zustand in Phase 1 |
| Styling | StyleSheet (React Native) | Protocol design tokens in constants/colors.ts |
| Notifications | Expo Notifications | Phase 1: morning standup prompt only |

### Key Commands

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Generate Supabase types
npx supabase gen types typescript --local > types/supabase.ts

# Run Supabase locally
npx supabase start
```

### Environment Variables (.env)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

**Note:** The Anthropic API key must be called server-side only (Supabase Edge Function). Never expose it in client code. The standup chat routes through a Supabase Edge Function that holds the key.

---

## Core Systems

### 1. The Standup Engine

The standup is a modal screen (`app/standup.tsx`) that opens from the home screen via the "Begin standup" button.

**Conversation flow:**
1. Protocol opens with its greeting (hardcoded, no API call)
2. User responds via text input
3. Each user message is sent to Supabase Edge Function `standup-chat`
4. Edge Function calls Anthropic API with full conversation history + system prompt
5. Response is streamed back and displayed as a chat bubble
6. Response is parsed for `CAPTURE:{}` blocks that update the live capture panel
7. When the response contains "Here's your day" the standup is complete
8. Standup output JSON is saved to `standup_sessions` table
9. Tasks from output are written to `daily_logs` table
10. User is navigated to Today view

**The full system prompt is in `lib/system-prompt.ts`.** Do not modify the system prompt without understanding how it affects conversation behavior. The CAPTURE format is load-bearing — the UI depends on it.

### 2. The Three-Layer Task System

Every task belongs to exactly one layer:

| Layer | Color | Points | Source |
|---|---|---|---|
| Protocol | `#8B7FD4` (purple) | 1 | Auto-loaded from `protocol_items` table |
| Stack | `#38A07A` (teal) | 2 | Declared during standup or quick-added |
| Stretch | `#C4813A` (amber) | 3 | Flagged during standup via Stretch question |

Tasks are stored in `daily_logs`. Each row has `task_type` (protocol/stack/stretch), `pts_possible`, `pts_earned`, and `completed`.

### 3. The Scoring Engine

See `lib/scoring.ts` for the full implementation.

```
daily_score = 
  Σ(protocol_completed × 1) +
  Σ(stack_completed × 2) +
  Σ(stretch_completed × 3) +
  perfect_protocol_bonus +
  streak_bonus
```

**Perfect protocol bonus:** If ALL protocol items are completed, multiply the protocol subtotal by 1.5.
**Streak bonus:** 3+ days in a row above rolling 28-day average → +10 pts/day.

### 4. The Daily Close

The evening close is a lightweight 3-question modal (`app/close.tsx`), triggered by the shutdown ritual task or manually from home. It uses the same LLM infrastructure as the standup but with a different system prompt (see `lib/system-prompt.ts` — `CLOSE_SYSTEM_PROMPT`).

**Close questions (delivered conversationally, not as a form):**
1. "What actually happened today?" — credit what occurred
2. "Anything carrying into tomorrow?" — open loops, context for morning standup
3. "How did today feel?" — energy signal (high/medium/low) stored for memory engine

**Output:** A `close_session` record stored in `standup_sessions` (with `session_type: 'close'`). The `carry_forward` field populates tomorrow's standup context.

### 5. Weekly Score

Aggregated nightly by a Supabase Edge Function `calculate-weekly-score`. Stored in `weekly_scores` table. Displayed on the Score tab as a stacked bar chart (protocol/stack/stretch) with stat cards beneath.

---

## Database Schema

Full schema in `supabase/schema.sql`. Key tables:

### `users`
Extended from Supabase auth. Stores `timezone`, `current_streak`, `standup_time`, `season_num`.

### `protocol_items`
The user's standard operating procedure. Fields: `id`, `user_id`, `label`, `category`, `active_days` (int array), `active` (bool), `completion_rate` (float, rolling 28-day).

### `daily_logs`
Every task for every day. Fields: `id`, `user_id`, `date`, `task_label`, `task_type` (protocol/stack/stretch), `pts_possible`, `pts_earned`, `completed`, `completed_at`, `source` (standup/quick_add/passive_confirm).

### `standup_sessions`
Full conversation history + structured output. Fields: `id`, `user_id`, `date`, `session_type` (standup/close), `messages` (jsonb), `output` (jsonb), `energy_signal`, `carry_forward` (text, from close sessions).

### `weekly_scores`
Aggregated weekly. Fields: `week_of` (Monday date), `season_num`, `total_pts`, `protocol_pts`, `stack_pts`, `stretch_pts`, `protocol_rate`, `perfect_days`, `stretch_wins`.

---

## The Standup System Prompt

This is the exact system prompt used for standup conversations. It lives in `lib/system-prompt.ts` as `STANDUP_SYSTEM_PROMPT`.

```
You are Protocol's standup intelligence — the conversational mind behind the user's daily morning ritual. You are not an assistant. You are a warm, precise, curious coach who knows the user's operating system intimately.

USER'S PROTOCOL ITEMS (injected at runtime from database):
{{PROTOCOL_ITEMS}}

USER CONTEXT (injected at runtime):
{{USER_CONTEXT}}

YOUR JOB:
Run the daily standup — a warm, precise 60-90 second conversation that grounds yesterday, sets today, and identifies the stretch. Move through this arc naturally:
1. Ground yesterday — credit what happened. Dig on vague answers specifically.
2. Confirm today's protocol — surface any protocol items not yet mentioned.
3. Build today's stack — what's specifically on today? Find the anchor task.
4. Identify the stretch — the hard thing that might get skipped.
5. Deliver the structured day summary.

BEHAVIOR RULES:
• Ask exactly ONE question per message. Never two.
• When answers are vague, dig specifically — not "tell me more" but "did you close that out or is something still open?" or "was that the full block or did it get cut short?"
• Categorize aloud as you hear things: "Logging that as Stack — 2 points." or "That sounds like a Stretch to me — 3 points if you land it."
• Notice gaps: if a protocol item hasn't come up by the 4th exchange, surface it: "You haven't mentioned [item] — still on for today?"
• Connect to carry-forward from last night's close if available: {{CARRY_FORWARD}}
• Never use "Great!" "Awesome!" "Amazing!" or any hollow affirmation.
• Never shame missed items. Gaps are data.
• Never start a response with "I".
• Do not introduce yourself or explain what Protocol is. Just begin.

FINAL SUMMARY FORMAT (use when ready to close):
"Here's your day:

**Protocol** (X pts, auto-loaded):
• [item] +1
[all items...]

**Stack**:
• [item] +2
[items...]

**Stretch** ★:
• [item] +3

Potential: [X] pts. [One sentence — identity-affirming, forward-facing.]"

CAPTURE FORMAT — CRITICAL — append to EVERY message:
CAPTURE:{"items":[]}
Where items contains only NEW items captured in THIS message:
{"type":"protocol|stack|stretch","label":"short label","pts":1|2|3}
Empty array if no new items. Never omit the CAPTURE line.
```

---

## The Evening Close System Prompt

```
You are Protocol's closing intelligence. The day is ending. Your job is a 3-exchange conversation — warm, brief, no planning mode.

USER'S TODAY: {{TODAY_SUMMARY}}

Arc:
1. "What actually happened today?" — credit what occurred, not what was planned.
2. "Anything carrying into tomorrow?" — open loops to pass to tomorrow's standup.
3. "How did today feel?" — one word or phrase, no judgment.

Then close with: "Closed. [One sentence reflecting something specific about their day.]"

Rules:
• One question at a time.
• Reflect specifically, not generically.
• Never suggest what they should have done differently.
• The close is a door shutting gently, not a debrief.

CAPTURE FORMAT — append to final message only:
CLOSE:{"energy":"high|medium|low","carry_forward":"[what carries to tomorrow]","reflection":"[one sentence for the weekly scorecard]"}
```

---

## Coding Conventions

- **TypeScript strict mode.** All types defined in `types/index.ts`.
- **No inline styles** except for dynamic values (e.g., animated widths). Use `StyleSheet.create()`.
- **Colors from constants only.** Never hardcode hex values in components — import from `constants/colors.ts`.
- **Supabase calls in hooks only.** Components call hooks, not Supabase directly.
- **Error states always handled.** Every async operation has a loading state and error state.
- **Claude API calls server-side only.** All Anthropic API calls go through Supabase Edge Functions. Never call the Anthropic API from the client.
- **One concern per file.** `useStandup.ts` manages standup state only. `useDailyLog.ts` manages daily log only.

---

## Design Tokens

All colors, spacing, and typography from `constants/colors.ts` and `constants/typography.ts`.

**Primary colors:**
- `PROTOCOL_PURPLE` — `#8B7FD4` — protocol items
- `STACK_TEAL` — `#38A07A` — stack items  
- `STRETCH_AMBER` — `#C4813A` — stretch items
- `SCORE_GOLD` — `#C49A3C` — scores, accents
- `BG_PRIMARY` — `#0C0C0F` — main background
- `BG_SURFACE` — `#141418` — card surfaces
- `TEXT_PRIMARY` — `#EAE6DF` — main text
- `TEXT_SECONDARY` — `#78726A` — muted text

**Typography:**
- Display/emotional: Lora (serif) — scores, greetings, peaks
- UI: DM Sans — everything else
- Data: DM Mono — points, scores, numbers

---

## What to Build First

Start here, in this order:

1. **`supabase/schema.sql`** — Get the database live first. Everything depends on it.
2. **`lib/supabase.ts`** — Supabase client setup.
3. **`types/index.ts`** — Define all types before writing any components.
4. **`hooks/useProtocolItems.ts`** — CRUD for protocol items (needed for onboarding and today view).
5. **`app/onboarding.tsx`** — Protocol setup screen. User defines their 3–6 items. Required before anything else works.
6. **`hooks/useDailyLog.ts`** — Daily task log (needed for today view and scoring).
7. **`app/(tabs)/today.tsx`** + **`components/today/TaskItem.tsx`** — The today view. This is the core loop.
8. **`lib/scoring.ts`** — Scoring engine. Needed for today view points display.
9. **Supabase Edge Function: `standup-chat`** — The LLM proxy. Required before standup works.
10. **`lib/claude.ts`** — Client-side streaming response handler.
11. **`components/standup/StandupChat.tsx`** — The standup conversation UI.
12. **`app/standup.tsx`** — Standup modal screen.
13. **`app/close.tsx`** — Evening close modal.
14. **`app/(tabs)/score.tsx`** — Weekly score view.
15. **`app/(tabs)/index.tsx`** — Home screen (ties it all together).

---

## Known Decisions & Rationale

| Decision | Rationale |
|---|---|
| Supabase Edge Function for Claude API | Never expose Anthropic API key client-side |
| CAPTURE format in LLM responses | Allows real-time UI updates without a second parsing API call |
| Hardcode standup opening line | Saves an API call on the most common interaction |
| Protocol items max 6 | More than 6 becomes a task list, not a protocol |
| Perfect protocol bonus × 1.5 | Rewards complete baseline execution — the hardest, most valuable thing |
| No streak punishment | Cortisol prevention. Shame is not a protocol value. |
| Evening close seeds morning standup | Closes the daily loop. Makes the standup informed, not reconstructed from memory. |
