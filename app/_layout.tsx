import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!ready) return

    const inAuth = segments[0] === 'auth'
    const inOnboarding = segments[0] === 'onboarding'

    if (!session) {
      // Not logged in — go to auth (unless already there)
      if (!inAuth) router.replace('/auth')
    } else {
      // Logged in — go to onboarding (for now, until onboarded flag is checked)
      if (inAuth) router.replace('/onboarding')
    }
  }, [session, ready, segments])

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0C0C0F' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="standup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="close" options={{ presentation: 'modal' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
      </Stack>
    </>
  )
}
