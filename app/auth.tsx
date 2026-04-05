import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'

export default function AuthScreen() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimEmail = email.trim().toLowerCase()
    const trimPassword = password.trim()
    if (!trimEmail || !trimPassword) return
    if (mode === 'signup' && !name.trim()) return

    setLoading(true)
    setError(null)

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimEmail,
        password: trimPassword,
        options: { data: { name: name.trim() } },
      })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
      }
      // Auth state change in _layout handles navigation
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: trimEmail,
        password: trimPassword,
      })
      if (loginError) {
        setError(loginError.message)
        setLoading(false)
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Protocol</Text>
        <Text style={styles.subtitle}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </Text>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your first name"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
          />
        )}

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.bgPrimary} size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'signup' ? 'Create account' : 'Log in'}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.toggleButton}
          onPress={() => {
            setMode(mode === 'signup' ? 'login' : 'signup')
            setError(null)
          }}
        >
          <Text style={styles.toggleText}>
            {mode === 'signup'
              ? 'Already have an account? Log in'
              : "Don't have an account? Sign up"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 36,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: Colors.bgHighest,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.danger,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.protocolPurple,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  toggleButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
})
