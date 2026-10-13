import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Button, Display, Input, T } from '@/components/ui';
import { login } from '@/lib/api';
import { colors, fg } from '@/lib/theme';

// The website's /admin/login page.
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
    try {
      await login(username.trim(), password.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/reviews');
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ width: '100%', maxWidth: 384, alignSelf: 'center' }}>
          <Display style={{ textAlign: 'center', marginBottom: 24 }}>Admin Login</Display>
          <View style={{ gap: 16 }}>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              autoComplete="current-password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            {error ? (
              <T size="sm" color={colors.primary}>
                {error}
              </T>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              label={submitting ? 'Logging in...' : 'Log In'}
              disabled={submitting}
              onPress={handleLogin}
              style={{ paddingHorizontal: 24, paddingVertical: 10 }}
            />
          </View>
          <T size="xs" color={fg(0.5)} style={{ marginTop: 16, textAlign: 'center' }}>
            You&apos;ll stay logged in on this device.
          </T>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
