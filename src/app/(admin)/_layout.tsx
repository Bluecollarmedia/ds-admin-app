import { View } from 'react-native';
import { Stack } from 'expo-router';

import { AdminShell } from '@/components/AdminShell';
import { colors } from '@/lib/theme';

// Every admin page sits under the same top bar + tabs, like the website.
export default function AdminLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AdminShell />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </View>
  );
}
