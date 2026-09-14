import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { colors } from '@/lib/theme';

const LABELS: Record<string, string> = {
  reviews: 'Reviews',
  settings: 'Settings',
  visitors: 'Visitors',
  appeals: 'Appeals',
  accounts: 'Accounts',
  comments: 'Comments',
  notifications: 'Notifications',
  storage: 'Storage',
};

// Placeholder section screen. Each of these will be built out into a full native
// screen that talks to the admin API. For now it confirms navigation + haptics.
export default function SectionScreen() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const label = (key && LABELS[key]) || 'Section';

  function back() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={back} hitSlop={12} style={styles.backRow}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.note}>Coming soon — this screen is being built.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  backRow: { paddingHorizontal: 20, paddingVertical: 12 },
  back: { fontSize: 16, fontWeight: '600', color: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '800', color: colors.foreground },
  note: { fontSize: 15, color: colors.muted },
});
