/**
 * Evening Close Modal
 *
 * Lightweight 3-exchange conversation to seal the day.
 * Same architecture as standup but using CLOSE_SYSTEM_PROMPT.
 *
 * Triggered by:
 * - Tapping the "Shutdown ritual" protocol item in Today view
 * - A gentle notification at user-configured time (default 9pm)
 *
 * Flow:
 * 1. Pull today's completed tasks to build todaySummary for the prompt
 * 2. Run 3-exchange conversation via CLOSE_SYSTEM_PROMPT
 * 3. Parse CLOSE block from final message
 * 4. Save session to standup_sessions (session_type: 'close')
 * 5. Store carry_forward for tomorrow's standup
 * 6. Dismiss modal with "day is closed" confirmation
 *
 * TODO: Build this screen
 */

import { View, Text } from 'react-native'
export default function CloseModal() {
  return <View style={{ flex: 1, backgroundColor: '#0C0C0F' }}><Text style={{ color: '#EAE6DF' }}>Evening Close — TODO</Text></View>
}
