import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { AsyncList } from '@/components/AsyncList';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { relativeTime } from '@/lib/time';
import { colors } from '@/lib/theme';

type Comment = {
  id: string;
  slug: string;
  videoTitle: string;
  authorName: string;
  avatarUrl: string | null;
  imageUrl: string | null;
  message: string;
  isReply: boolean;
  deleted: boolean;
  createdAt: string;
};

export function CommentsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ comments: Comment[] }>(
    '/api/admin/comments'
  );
  const [busy, setBusy] = useState<string | null>(null);

  function confirmDelete(c: Comment) {
    Alert.alert('Delete comment', "It'll be hidden from the site but kept here, marked deleted.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(c.id);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            const res = await adminFetch(`/api/admin/comments/${c.slug}/${c.id}`, { method: 'DELETE' });
            if (!res.ok) Alert.alert('Could not delete', 'Try again.');
            else refresh();
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <AsyncList
      title="Comments"
      items={data?.comments}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      keyExtractor={(c) => c.id}
      emptyText="No comments yet."
      renderItem={(c) => (
        <View style={[styles.card, c.deleted && styles.dim]}>
          <View style={styles.row}>
            {c.avatarUrl ? (
              <Image source={{ uri: c.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{c.authorName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{c.authorName}</Text>
                {c.isReply && <Badge text="Reply" bg={colors.surfaceMuted} fg={colors.muted} />}
                {c.deleted && <Badge text="Deleted" bg="#fde2e6" fg={colors.primary} />}
                <Text style={styles.time}>{relativeTime(c.createdAt)}</Text>
              </View>
              {!!c.message && <Text style={styles.message}>{c.message}</Text>}
              {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={styles.attach} contentFit="cover" /> : null}
              <View style={styles.footer}>
                <Text style={styles.video} numberOfLines={1}>
                  {c.videoTitle}
                </Text>
                {!c.deleted && (
                  <Pressable onPress={() => confirmDelete(c)} disabled={busy === c.id} hitSlop={8}>
                    <Text style={styles.delete}>Delete</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      )}
    />
  );
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12 },
  dim: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.white, fontSize: 15, fontWeight: '800' },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  time: { fontSize: 11, color: colors.muted },
  message: { fontSize: 14, color: colors.foreground, lineHeight: 19 },
  attach: { width: 64, height: 64, borderRadius: 8, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  video: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.muted },
  delete: { fontSize: 12, fontWeight: '700', color: colors.primary },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
