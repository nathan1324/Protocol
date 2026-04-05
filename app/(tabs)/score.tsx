/**
 * Score Screen
 *
 * Weekly scorecard view:
 * - Large season score (Lora font, gold)
 * - Stacked bar chart for current week (purple/teal/amber by day)
 * - Stat cards: protocol rate, stretch wins, streak, season rank
 * - "Protocol noticed" insight card (gold, from weekly_scores.peak_moment)
 *
 * Data needed:
 * - useWeekScore(userId)
 *
 * Components needed:
 * - WeekChart (components/score/WeekChart.tsx)
 * - StatCard (components/score/StatCard.tsx)
 *
 * TODO: Build this screen
 */

import { View, Text } from 'react-native'
export default function ScoreScreen() {
  return <View style={{ flex: 1, backgroundColor: '#0C0C0F' }}><Text style={{ color: '#EAE6DF' }}>Score — TODO</Text></View>
}
