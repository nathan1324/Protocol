import { Tabs } from 'expo-router'
import { Colors } from '@/constants/colors'

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: Colors.bgSurface, borderTopColor: Colors.border, borderTopWidth: 0.5, height: 80 },
      tabBarActiveTintColor: Colors.scoreGold,
      tabBarInactiveTintColor: Colors.textTertiary,
      tabBarLabelStyle: { fontSize: 9, fontWeight: '600', letterSpacing: 0.04 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="score" options={{ title: 'Score' }} />
      <Tabs.Screen name="patterns" options={{ title: 'Patterns' }} />
    </Tabs>
  )
}
