import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { relativeTime } from '@/lib/time';
import { colors } from '@/lib/theme';

type CommentNode = {
  id: string;
  message: string;
  createdAt: string;
  authorName: string;
  avatarUrl: string | null;
  imageUrl: string | null;
  isGuest: boolean;
  replies: CommentNode[];
};

// Per-review comment moderation, shown at the bottom of Edit Review — mirrors
// the web's AdminCommentsPanel (view + delete, threaded).
export function CommentsPanel({ slug }: { slug: string }) {
  const { data, loading, refresh } = useAdminData<{ comments: CommentNode[] }>(`/api/admin/comments/${slug}`);
  const [busyId, setBusyId] = useState<string | null>(null);
  const comments = data?.comments ?? [];
  const count = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  function confirmDelete(id: string) {
    Alert.alert('Delete comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            await adminFetch(`/api/admin/comments/${slug}/${id}`, { method: 'DELETE' });
            refresh();
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  function renderComment(c: CommentNode, indent = false) {
    return (
      <View key={c.id} style={[styles.row, indent && styles.rowIndent]}>
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
            <Text style={styles.time}>{relativeTime(c.createdAt)}</Text>
            {c.isGuest && (
              <View style={styles.guestBadge}>
                <Text style={styles.guestText}>Guest</Text>
              </View>
            )}
          </View>
          {!!c.message && <Text style={styles.message}>{c.message}</Text>}
          {c.imageUrl && <Image source={{ uri: c.imageUrl }} style={styles.attach} contentFit="cover" />}
        </View>
        <Pressable onPress={() => confirmDelete(c.id)} disabled={busyId === c.id} hitSlop={8}>
          <Text style={styles.delete}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Comments {!loading && `(${count})`}</Text>
      {loading ? (
        <Text style={styles.note}>Loading comments...</Text>
      ) : comments.length === 0 ? (
        <Text style={styles.note}>No comments on this review yet.</Text>
      ) : (
        <View style={{ gap: 4 }}>
          {comments.map((c) => (
            <View key={c.id}>
              {renderComment(c)}
              {c.replies.map((r) => renderComment(r, true))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 8, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  note: { fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, alignItems: 'flex-start' },
  rowIndent: { paddingLeft: 24 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  avatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.white, fontSize: 13, fontWeight: '800' },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  time: { fontSize: 11, color: colors.muted },
  guestBadge: { backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  guestText: { fontSize: 9, fontWeight: '800', color: colors.muted },
  message: { fontSize: 13, color: colors.foreground },
  attach: { width: 56, height: 56, borderRadius: 8, marginTop: 2 },
  delete: { fontSize: 12, fontWeight: '700', color: colors.primary },
});
