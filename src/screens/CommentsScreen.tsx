import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Page } from '@/components/Page';
import { ErrorText, Loading, PageHeading, T } from '@/components/ui';
import { adminFetch, adminJson } from '@/lib/api';
import { relativeTime } from '@/lib/time';
import { colors, fg, fonts, primaryA } from '@/lib/theme';

type Row = {
  id: string;
  slug: string;
  videoTitle: string;
  authorName: string;
  avatarUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  message: string;
  isReply: boolean;
  deleted: boolean;
  createdAt: string;
};

// The website's /admin/comments page (AdminAllComments).
export function CommentsScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (offset: number) => {
    const d = await adminJson<{ comments: Row[]; hasMore: boolean }>(`/api/admin/comments?offset=${offset}`);
    setHasMore(d.hasMore);
    return d.comments;
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setRows(await load(0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [load]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  async function loadMore() {
    const batch = await load(rows.length).catch(() => []);
    setRows((prev) => [...prev, ...batch]);
  }

  function handleDelete(row: Row) {
    Alert.alert(
      'Delete this comment?',
      "It'll be hidden from the site but you'll still see it here, marked deleted.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(row.id);
            await adminFetch(`/api/admin/comments/${row.slug}/${row.id}`, { method: 'DELETE' }).catch(() => {});
            setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, deleted: true } : r)));
            setBusyId(null);
          },
        },
      ]
    );
  }

  async function handleRestore(row: Row) {
    setBusyId(row.id);
    await adminFetch(`/api/admin/comments/${row.slug}/${row.id}`, { method: 'PUT' }).catch(() => {});
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, deleted: false } : r)));
    setBusyId(null);
  }

  return (
    <Page
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
      }}
    >
      <PageHeading title="All Comments" description="Every comment and reply across every video, most recent first." />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <T size="base" color={fg(0.6)} style={{ marginTop: 32, textAlign: 'center' }}>
          No comments yet.
        </T>
      ) : (
        <View style={{ marginTop: 24 }}>
          {rows.map((row, i) => (
            <View key={row.id} style={[styles.row, i > 0 && styles.divider, row.deleted && { opacity: 0.6 }]}>
              {row.avatarUrl ? (
                <Image source={{ uri: row.avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.initial]}>
                  <T style={{ fontFamily: fonts.display, fontSize: 16 }} color={colors.white}>
                    {row.authorName.charAt(0).toUpperCase()}
                  </T>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <T size="sm" weight="semibold">
                    {row.authorName}
                  </T>
                  {row.isReply && <Tag label="REPLY" bg={colors.surfaceMuted} color={fg(0.5)} />}
                  {row.deleted && <Tag label="DELETED" bg={primaryA(0.1)} color={colors.primary} />}
                  <T size="xs" color={fg(0.4)}>
                    {relativeTime(row.createdAt)}
                  </T>
                </View>
                {row.message ? (
                  <T size="sm" color={fg(0.8)} style={{ marginTop: 2 }}>
                    {row.message}
                  </T>
                ) : null}
                {row.imageUrl && <Image source={{ uri: row.imageUrl }} style={styles.photo} contentFit="cover" />}
                {row.videoUrl && (
                  <Pressable style={styles.video} onPress={() => Linking.openURL(row.videoUrl!)}>
                    <T size="2xl" color={colors.white}>
                      ▶
                    </T>
                  </Pressable>
                )}
                <View style={styles.meta}>
                  <T size="xs" weight="semibold" color={fg(0.5)}>
                    {row.videoTitle}
                  </T>
                  {!row.deleted ? (
                    <Pressable onPress={() => handleDelete(row)} disabled={busyId === row.id} hitSlop={6}>
                      <T size="xs" weight="semibold" color={colors.primary}>
                        Delete
                      </T>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => handleRestore(row)} disabled={busyId === row.id} hitSlop={6}>
                      <T size="xs" weight="semibold" color={colors.accent}>
                        Restore
                      </T>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          ))}
          {hasMore && (
            <Pressable onPress={loadMore} style={{ alignSelf: 'center', paddingVertical: 16 }}>
              <T size="sm" weight="semibold" color={colors.primary}>
                Load more comments
              </T>
            </Pressable>
          )}
        </View>
      )}
    </Page>
  );
}

function Tag({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2 }}>
      <T size="xs10" weight="semibold" color={color} style={{ letterSpacing: 0.25 }}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  initial: { backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  photo: { marginTop: 6, width: 64, height: 64, borderRadius: 8 },
  video: {
    marginTop: 6,
    width: 160,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
});
