import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { login } from '@/lib/api';
import { colors } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(username.trim(), password.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/dashboard');
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.center}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.brand}>D&amp;S ADMIN</Text>
          <Text style={styles.subtitle}>Sign in to manage the site</Text>

          <View style={styles.form}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={handleLogin}
              disabled={submitting}
              style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footnote}>You&apos;ll stay signed in on this device.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  brand: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.foreground,
    textAlign: 'center',
  },
  subtitle: { marginTop: 6, fontSize: 15, color: colors.muted, textAlign: 'center' },
  form: { marginTop: 32, gap: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.foreground,
  },
  error: { color: colors.primary, fontSize: 14, textAlign: 'center' },
  button: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  footnote: { marginTop: 20, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
