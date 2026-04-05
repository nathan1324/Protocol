// Protocol Design Tokens
// Never hardcode hex values in components — always import from here

export const Colors = {
  // ─── Backgrounds ──────────────────────────────────────────
  bgPrimary: '#0C0C0F',       // Main app background
  bgSurface: '#141418',       // Cards, nav bars
  bgElevated: '#1A1A20',      // Elevated surfaces
  bgHighest: '#222228',       // Inputs, selected states

  // ─── Borders ──────────────────────────────────────────────
  border: 'rgba(255,255,255,0.06)',
  borderMed: 'rgba(255,255,255,0.11)',
  borderStrong: 'rgba(255,255,255,0.18)',

  // ─── Text ─────────────────────────────────────────────────
  textPrimary: '#EAE6DF',     // Main readable text
  textSecondary: '#78726A',   // Muted / secondary
  textTertiary: '#38352F',    // Hints, placeholders

  // ─── Task Layer Colors ────────────────────────────────────
  protocolPurple: '#8B7FD4',
  protocolPurpleBg: 'rgba(139,127,212,0.13)',
  protocolPurpleBorder: 'rgba(139,127,212,0.3)',

  stackTeal: '#38A07A',
  stackTealBg: 'rgba(56,160,122,0.13)',
  stackTealBorder: 'rgba(56,160,122,0.3)',

  stretchAmber: '#C4813A',
  stretchAmberBg: 'rgba(196,129,58,0.13)',
  stretchAmberBorder: 'rgba(196,129,58,0.3)',

  // ─── Score / Brand Gold ───────────────────────────────────
  scoreGold: '#C49A3C',
  scoreGoldLight: '#E0B558',
  scoreGoldBg: 'rgba(196,154,60,0.1)',
  scoreGoldBorder: 'rgba(196,154,60,0.25)',

  // ─── Semantic ─────────────────────────────────────────────
  success: '#38A07A',         // Completion states
  danger: '#C4534A',          // Errors
} as const

// Point values by task type — single source of truth
export const Points = {
  protocol: 1,
  stack: 2,
  stretch: 3,
} as const

// Perfect protocol day multiplier
export const PERFECT_PROTOCOL_MULTIPLIER = 1.5

// Streak bonus (pts per day after 3+ day streak above avg)
export const STREAK_BONUS_PTS = 10

// Task type display config
export const TaskConfig = {
  protocol: {
    label: 'Protocol',
    color: Colors.protocolPurple,
    bg: Colors.protocolPurpleBg,
    border: Colors.protocolPurpleBorder,
    pts: Points.protocol,
  },
  stack: {
    label: 'Stack',
    color: Colors.stackTeal,
    bg: Colors.stackTealBg,
    border: Colors.stackTealBorder,
    pts: Points.stack,
  },
  stretch: {
    label: 'Stretch',
    color: Colors.stretchAmber,
    bg: Colors.stretchAmberBg,
    border: Colors.stretchAmberBorder,
    pts: Points.stretch,
  },
} as const
