import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { AsyncList } from '@/components/AsyncList';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { colors } from '@/lib/theme';

type BucketFile = { key: string; size: number; lastModified: string; url: string | null };
type StorageData = { totalFiles: number; orphaned: BucketFile[]; orphanedBytes: number };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function fileName(key: string): string {
  return key.split('/').pop() ?? key;
}

function isImage(key: string): boolean {
  return !key.startsWith('videos/');
}

export function StorageScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<StorageData>('/api/admin/storage');
  const [busy, setBusy] = useState<string | null>(null);

  function confirmDelete(f: BucketFile) {
    Alert.alert('Delete file', `Delete this file from the bucket?\n\n${fileName(f.key)}\n\nThis can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(f.key);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            const res = await adminFetch('/api/admin/storage/delete', {
              method: 'DELETE',
              body: JSON.stringify({ key: f.key }),
            });
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
    <AsyncList
      title="Storage"
      items={data?.orphaned}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      keyExtractor={(f) => f.key}
      emptyText="Nothing unused — every file is linked to something."
      listHeader={
        data ? (
          <Text style={styles.summary}>
            {data.totalFiles} files in the bucket · {data.orphaned.length} unused, using{' '}
            {formatBytes(data.orphanedBytes)}.
          </Text>
        ) : undefined
      }
      renderItem={(f) => (
        <View style={styles.card}>
          <View style={styles.thumb}>
            {isImage(f.key) && f.url ? (
              <Image source={{ uri: f.url }} style={styles.thumbImg} contentFit="cover" />
            ) : (
              <Text style={styles.play}>▶</Text>
            )}
          </View>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {fileName(f.key)}
            </Text>
            <Text style={styles.meta}>
              {formatBytes(f.size)} · {new Date(f.lastModified).toLocaleDateString()}
            </Text>
          </View>
          <Pressable
            onPress={() => confirmDelete(f)}
            disabled={busy === f.key}
            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  thumb: {
    width: 72,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  play: { fontSize: 18, color: colors.muted },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.muted },
  delete: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.7 },
});
