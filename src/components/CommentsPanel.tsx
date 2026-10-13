import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { Display, T } from './ui';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { relativeTime } from '@/lib/time';
import { colors, fg } from '@/lib/theme';

type CommentNode = {
  id: string;
  message: string;
  createdAt: string;
  authorName: string;
  imageUrl: string | null;
  isGuest: boolean;
  replies: CommentNode[];
};

// The website's AdminCommentsPanel, shown under Edit Review.
export function CommentsPanel({ slug }: { slug: string }) {
  const { data, loading, refresh } = useAdminData<{ comments: CommentNode[] }>(`/api/admin/comments/${slug}`);
  const [busyId, setBusyId] = useState<string | null>(null);
  const comments = data?.comments ?? null;
  const count = comments?.reduce((sum, c) => sum + 1 + c.replies.length, 0) ?? 0;

  function handleDelete(id: string) {
    Alert.alert('Delete this comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          await adminFetch(`/api/admin/comments/${slug}/${id}`, { method: 'DELETE' }).catch(() => {});
          await refresh();
          setBusyId(null);
        },
      },
    ]);
  }

  function renderComment(c: CommentNode, indent = false) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 12,
          paddingLeft: indent ? 24 : 0,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <T size={indent ? 'xs' : 'sm'} weight="semibold">
              {c.authorName}
            </T>
            <T size="xs" color={fg(0.4)}>
              {relativeTime(c.createdAt)}
            </T>
            {c.isGuest && (
              <View style={{ borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 2 }}>
                <T size="xs10" weight="semibold" color={fg(0.5)}>
                  Guest
                </T>
              </View>
            )}
          </View>
          {!!c.message && (
            <T size={indent ? 'xs' : 'sm'} color={fg(0.8)} style={{ marginTop: 2 }}>
              {c.message}
            </T>
          )}
          {c.imageUrl && (
            <Image
              source={{ uri: c.imageUrl }}
              style={{ marginTop: 6, width: 64, height: 64, borderRadius: 8 }}
              contentFit="cover"
            />
          )}
        </View>
        <Pressable onPress={() => handleDelete(c.id)} disabled={busyId === c.id} hitSlop={8}>
          <T size="xs" weight="semibold" color={colors.primary} style={busyId === c.id && { opacity: 0.5 }}>
            Delete
          </T>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 24 }}>
      <Display size="2xl">Comments {comments ? `(${count})` : ''}</Display>
      <View style={{ marginTop: 8 }}>
        {loading && !comments && (
          <T size="sm" color={fg(0.6)} style={{ paddingVertical: 12 }}>
            Loading comments...
          </T>
        )}
        {comments?.map((c, i) => (
          <View key={c.id} style={i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }}>
            {renderComment(c)}
            {c.replies.map((r) => (
              <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: 'rgba(231,220,201,0.6)' }}>
                {renderComment(r, true)}
              </View>
            ))}
          </View>
        ))}
        {comments?.length === 0 && (
          <T size="sm" color={fg(0.6)} style={{ paddingVertical: 12 }}>
            No comments on this review yet.
          </T>
        )}
      </View>
    </View>
  );
}
