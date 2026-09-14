import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { logout } from '@/lib/api';
import { colors } from '@/lib/theme';

const SECTIONS: { key: string; label: string; icon: string }[] = [
  { key: 'reviews', label: 'Reviews', icon: '🎬' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
  { key: 'visitors', label: 'Visitors', icon: '📍' },
  { key: 'appeals', label: 'Appeals', icon: '📩' },
  { key: 'accounts', label: 'Accounts', icon: '👤' },
  { key: 'comments', label: 'Comments', icon: '💬' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'storage', label: 'Storage', icon: '🗂️' },
];

export default function Dashboard() {
  const router = useRouter();

  function openSection(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/section/[key]', params: { key } });
  }

  async function handleLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/login');
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.brand}>D&amp;S ADMIN</Text>
          <Pressable onPress={handleLogout} hitSlop={12}>
            <Text style={styles.logout}>Log out</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => openSection(s.key)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <Text style={styles.cardIcon}>{s.icon}</Text>
              <Text style={styles.cardLabel}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5, color: colors.foreground },
  logout: { fontSize: 14, fontWeight: '600', color: colors.primary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    gap: 14,
  },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  cardPressed: { opacity: 0.8, borderColor: colors.primary },
  cardIcon: { fontSize: 34 },
  cardLabel: { fontSize: 16, fontWeight: '700', color: colors.foreground },
});
