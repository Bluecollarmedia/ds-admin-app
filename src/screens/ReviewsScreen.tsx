import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { Header } from '@/components/Header';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { colors } from '@/lib/theme';

type Review = {
  slug: string;
  title: string;
  store: string;
  city: string;
  rating: number;
  categories: string[];
  status: 'published' | 'draft' | 'locked' | 'vault';
  videoKey?: string;
  thumbnailUrl: string | null;
  realViews: number;
  displayViews?: number;
  price?: string;
  description: string;
  reviewer: string;
};

const STATUS_LABEL: Record<Review['status'], string> = {
  published: 'Published',
  draft: 'Draft',
  locked: 'Locked',
  vault: 'Vault',
};

function StatusBadge({ status }: { status: Review['status'] }) {
  const bg =
    status === 'published' ? '#d1fae5' : status === 'locked' ? '#fef3c7' : status === 'vault' ? '#ede9fe' : '#eee6da';
  const fg =
    status === 'published' ? '#047857' : status === 'locked' ? '#b45309' : status === 'vault' ? '#6d28d9' : '#6b625a';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function ReviewsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ reviews: Review[] }>(
    '/api/admin/reviews'
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function togglePublish(r: Review) {
    setBusy(r.slug);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await adminFetch(`/api/admin/reviews/${r.slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: r.title,
          store: r.store,
          city: r.city,
          categories: r.categories,
          rating: r.rating,
          price: r.price,
          description: r.description,
          reviewer: r.reviewer,
          videoKey: r.videoKey,
          status: r.status === 'published' ? 'draft' : 'published',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        Alert.alert('Could not update', d?.error ?? 'Try again.');
      } else {
        refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete(r: Review) {
    Alert.alert('Delete review', `Delete "${r.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(r.slug);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            const res = await adminFetch(`/api/admin/reviews/${r.slug}`, { method: 'DELETE' });
            if (!res.ok) {
              const d = await res.json().catch(() => null);
              Alert.alert('Could not delete', d?.error ?? 'Try again.');
            } else {
              refresh();
            }
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <Header title="Reviews" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={refresh} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.reviews ?? []}
          keyExtractor={(r) => r.slug}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>No reviews yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Image
                  source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : undefined}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.store} · {item.city} · {item.rating}/10
                  </Text>
                  <View style={styles.badges}>
                    <StatusBadge status={item.status} />
                    <View style={[styles.badge, { backgroundColor: item.videoKey ? '#d1fae5' : '#eee6da' }]}>
                      <Text style={[styles.badgeText, { color: item.videoKey ? '#047857' : '#6b625a' }]}>
                        {item.videoKey ? 'Video' : 'No video'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={styles.views}>
                {item.realViews.toLocaleString()} real · {(item.displayViews ?? 0).toLocaleString()} shown
              </Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => togglePublish(item)}
                  disabled={busy === item.slug || item.status === 'locked' || item.status === 'vault'}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.actionText}>
                    {item.status === 'published' ? 'Make Private' : 'Publish'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  disabled={busy === item.slug}
                  style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, pressed && styles.pressed]}
                >
                  <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: colors.primary, fontSize: 14 },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary },
  retryText: { color: colors.white, fontWeight: '700' },
  list: { padding: 16, gap: 14 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 96, height: 58, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  info: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.muted },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  views: { fontSize: 12, color: colors.muted },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
  },
  deleteBtn: { borderColor: colors.primary },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  deleteText: { color: colors.primary },
  pressed: { opacity: 0.7 },
});
