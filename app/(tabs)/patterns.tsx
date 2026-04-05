/**
 * Patterns Screen — Phase 3
 *
 * Shows memory engine output:
 * - Detected patterns ("Your best days start with a workout before 8am")
 * - Template suggestions
 * - Protocol drift warnings
 * - Season-over-season comparison
 *
 * Stub for Phase 3. For now just shows a "patterns are forming" empty state.
 *
 * TODO: Build in Phase 3
 */

import { View, Text } from 'react-native'
export default function PatternsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0C0C0F', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ color: '#EAE6DF', fontSize: 22, fontFamily: 'serif', textAlign: 'center', marginBottom: 12 }}>Patterns are forming.</Text>
      <Text style={{ color: '#78726A', fontSize: 13, textAlign: 'center', lineHeight: 22 }}>Protocol needs a few more weeks of your data. Keep running your standup daily.</Text>
    </View>
  )
}
