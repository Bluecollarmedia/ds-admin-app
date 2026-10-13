import { StyleSheet, View } from 'react-native';

import { Page } from '@/components/Page';
import { ErrorText, Loading, PageHeading, T } from '@/components/ui';
import { relativeTime } from '@/lib/time';
import { useAdminData } from '@/lib/useAdminData';
import { colors, fg, primaryA } from '@/lib/theme';

type Notification = {
  id: string;
  type: string;
  videoTitle: string;
  message: string;
  read: boolean;
  createdAt: string;
};

// The website's /admin/notifications page. Opening it marks everything read,
// same as the web.
export function NotificationsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ notifications: Notification[] }>(
    '/api/admin/notifications'
  );
  const items = data?.notifications ?? [];

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <PageHeading title="Notifications" />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        <T size="base" color={fg(0.6)} style={{ marginTop: 48, textAlign: 'center' }}>
          No comment activity yet.
        </T>
      ) : (
        <View style={{ marginTop: 16 }}>
          {items.map((n, i) => (
            <View key={n.id} style={[styles.row, i > 0 && styles.divider, !n.read && { backgroundColor: primaryA(0.05) }]}>
              <View style={styles.head}>
                <T size="sm" weight="semibold" style={{ flex: 1 }}>
                  {n.type === 'new_reply' ? 'New reply' : 'New comment'}
                  <T size="sm" color={fg(0.5)}>
                    {'  '}on {n.videoTitle}
                  </T>
                </T>
                <T size="xs" color={fg(0.4)}>
                  {relativeTime(n.createdAt)}
                </T>
              </View>
              <T size="sm" color={fg(0.7)} style={{ marginTop: 2 }}>
                {n.message}
              </T>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
});
