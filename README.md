# Protocol

> The ambient achievement operating system.

## Philosophy

Protocol is not a to-do app. It is a personal operating system that rewards your standard protocol — the daily baseline that makes every good day possible — and layers achievement on top. It should feel like the Oura ring of achievement: invisible until you notice it, and every time you notice it you're grateful.

Read `CLAUDE.md` before touching any code. It is the source of truth.

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Set up environment
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# 3. Set up Supabase
# Create a project at supabase.com
# Run supabase/schema.sql in the SQL editor

# 4. Deploy the standup Edge Function (see supabase/functions/)
npx supabase functions deploy standup-chat
# Set ANTHROPIC_API_KEY in Supabase dashboard → Edge Functions → Secrets

# 5. Start
npx expo start
```

## Supabase Edge Function

The Claude API is called server-side only. Create `supabase/functions/standup-chat/index.ts`:

```typescript
import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

Deno.serve(async (req) => {
  const { messages, system, session_type } = await req.json()
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system,
    messages,
  })
  
  const content = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
  
  return new Response(JSON.stringify({ content }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

## Build Order (Phase 1)

Follow the order in CLAUDE.md exactly. Start with the database schema, not the UI.

1. `supabase/schema.sql` → get DB live
2. `hooks/useProtocolItems` + `app/onboarding` → protocol setup
3. `hooks/useDailyLog` + `app/(tabs)/today` → the core loop
4. Edge Function `standup-chat` → LLM proxy
5. `app/standup` → the standup modal
6. `app/close` → evening close
7. `app/(tabs)/score` → weekly score
8. `app/(tabs)/index` → home screen

## Color System

All colors in `constants/colors.ts`. Never hardcode hex values.

- Protocol items → `protocolPurple` (#8B7FD4)
- Stack items → `stackTeal` (#38A07A)
- Stretch items → `stretchAmber` (#C4813A)
- Scores → `scoreGold` (#C49A3C)

## The Three Design Laws

1. **Ambient over present** — does this make Protocol more invisible or more intrusive?
2. **Reflect, never judge** — the score is a mirror, not a leash
3. **Identity over outcome** — "you ran a clean protocol" not "you completed 7 tasks"

Every PR is evaluated against these three laws.
