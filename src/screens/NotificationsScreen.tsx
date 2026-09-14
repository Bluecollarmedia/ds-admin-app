import { StyleSheet, Text, View } from 'react-native';

import { AsyncList } from '@/components/AsyncList';
import { useAdminData } from '@/lib/useAdminData';
import { relativeTime } from '@/lib/time';
import { colors } from '@/lib/theme';

type Notification = {
  id: string;
  type: string;
  videoTitle: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ notifications: Notification[] }>(
    '/api/admin/notifications'
  );

  return (
    <AsyncList
      title="Notifications"
      items={data?.notifications}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      keyExtractor={(n) => n.id}
      emptyText="No comment activity yet."
      renderItem={(n) => (
        <View style={[styles.card, !n.read && styles.unread]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {n.type === 'new_reply' ? 'New reply' : 'New comment'}
              <Text style={styles.on}> on {n.videoTitle}</Text>
            </Text>
            <Text style={styles.time}>{relativeTime(n.createdAt)}</Text>
          </View>
          {!!n.message && <Text style={styles.message}>{n.message}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 4 },
  unread: { borderColor: colors.primary, backgroundColor: '#fdf2f4' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.foreground },
  on: { fontWeight: '400', color: colors.muted },
  time: { fontSize: 11, color: colors.muted },
  message: { fontSize: 13, color: colors.foreground },
});
