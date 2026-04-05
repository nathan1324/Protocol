/**
 * Home Screen
 *
 * Shows:
 * - Greeting with current time ("Good morning, [Name].")
 * - Season score card with mini bar chart of the week
 * - Today's protocol preview (4 items with purple dots)
 * - "Begin standup" CTA button (navigates to /standup modal)
 * - If standup already done today: shows "Standup done ✓" + today's earned pts
 *
 * Data needed:
 * - useWeekScore() for season score + mini bars
 * - useProtocolItems() for the protocol preview
 * - useStandupToday() — check if standup_sessions has a row for today (standup type)
 *
 * TODO: Build this screen
 */

import { View, Text } from 'react-native'
export default function HomeScreen() {
  return <View style={{ flex: 1, backgroundColor: '#0C0C0F' }}><Text style={{ color: '#EAE6DF' }}>Home — TODO</Text></View>
}
