import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { colors } from '@/lib/theme';

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  function back() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }
  return (
    <View style={styles.header}>
      <Pressable onPress={back} hitSlop={12} style={styles.backBtn}>
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  back: { fontSize: 30, lineHeight: 32, color: colors.primary, fontWeight: '400' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.foreground },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
