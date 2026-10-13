import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { BackfillDurations } from '@/components/BackfillDurations';
import { Page } from '@/components/Page';
import { Button, Card, Display, Divider, ErrorText, Input, Loading, Pill, T } from '@/components/ui';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { formatViewsFull, randomClimbTarget, suggestedClimbTarget } from '@/lib/viewFormat';
import { accentA, colors, fg, tw } from '@/lib/theme';

type ViewSetting =
  | { mode: 'fixed'; value: number }
  | { mode: 'auto'; start: string; startViews: number; target: number };

export type AdminReview = {
  slug: string;
  title: string;
  store: string;
  city: string;
  rating: number;
  categories: string[];
  status: 'published' | 'draft' | 'locked' | 'vault';
  videoKey?: string;
  thumbnailKey?: string;
  videoUrl?: string | null;
  durationSeconds?: number;
  thumbnailUrl: string | null;
  secondReviewer?: string;
  secondReviewerVideoUrl?: string | null;
  realViews: number;
  displayViews?: number;
  viewSetting?: ViewSetting | null;
  excludeFromRankings?: boolean;
  price?: string;
  description: string;
  reviewer: string;
};

// The website's /admin page: "Admin · Reviews" + "Add New Review", then one
// card per review (AdminReviewCard).
export function ReviewsScreen() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh, reload } = useAdminData<{ reviews: AdminReview[] }>(
    '/api/admin/reviews'
  );
  // Coming back from Add/Edit Review: pick up the change.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) reload();
      focusedOnce.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );
  const reviews = data?.reviews ?? [];

  const missingDurations = reviews
    .filter((r) => r.videoUrl && typeof r.durationSeconds !== 'number')
    .map((r) => ({ slug: r.slug, videoUrl: r.videoUrl! }));

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.heading}>
        <Display>Admin · Reviews</Display>
        <Button
          variant="primary"
          size="sm"
          style={{ paddingHorizontal: 20, paddingVertical: 8 }}
          label="+ Add New Review"
          onPress={() => router.push('/new-review')}
        />
      </View>

      <View style={{ marginTop: 32 }}>
        <BackfillDurations items={missingDurations} />
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} onRetry={refresh} />
      ) : (
        <View style={{ marginTop: 8, gap: 16 }}>
          {reviews.map((r) => (
            <ReviewCard key={r.slug} review={r} onChanged={refresh} />
          ))}
          {reviews.length === 0 && (
            <T color={fg(0.6)} style={{ marginTop: 32, textAlign: 'center' }} size="base">
              No reviews yet — tap &quot;Add New Review&quot; to create the first one.
            </T>
          )}
        </View>
      )}
    </Page>
  );
}

function ReviewCard({ review, onChanged }: { review: AdminReview; onChanged: () => void }) {
  const router = useRouter();
  const views = review.realViews ?? 0;
  const publicViews = review.displayViews ?? 0;
  const viewSetting = review.viewSetting ?? null;
  const [busy, setBusy] = useState(false);
  const [editingViews, setEditingViews] = useState(false);
  const [viewsInput, setViewsInput] = useState(String(publicViews));
  const [climbTarget, setClimbTarget] = useState(
    String(viewSetting?.mode === 'auto' ? viewSetting.target : suggestedClimbTarget(review.slug))
  );

  async function send(path: string, init: RequestInit, failMsg: string) {
    setBusy(true);
    try {
      const res = await adminFetch(path, init);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        Alert.alert(d?.error ?? failMsg);
        return false;
      }
      return true;
    } catch {
      Alert.alert(failMsg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function postViews(payload: Record<string, unknown>) {
    const ok = await send(
      '/api/admin/views',
      { method: 'POST', body: JSON.stringify({ slug: review.slug, ...payload }) },
      "Couldn't update the view count."
    );
    if (ok) {
      setEditingViews(false);
      onChanged();
    }
  }

  async function togglePublish() {
    const ok = await send(
      `/api/admin/reviews/${review.slug}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          title: review.title,
          store: review.store,
          city: review.city,
          categories: review.categories,
          rating: review.rating,
          price: review.price,
          description: review.description,
          reviewer: review.reviewer,
          videoKey: review.videoKey,
          thumbnailKey: review.thumbnailKey,
          status: review.status === 'published' ? 'draft' : 'published',
        }),
      },
      "Couldn't update."
    );
    if (ok) onChanged();
  }

  function handleDelete() {
    Alert.alert(`Delete "${review.title}"?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await send(`/api/admin/reviews/${review.slug}`, { method: 'DELETE' }, "Couldn't delete.");
          if (ok) onChanged();
        },
      },
    ]);
  }

  async function toggleRankingExclusion() {
    const ok = await send(
      `/api/admin/reviews/${review.slug}/toggle-ranking`,
      { method: 'PATCH' },
      "Couldn't update ranking exclusion."
    );
    if (ok) onChanged();
  }

  const isProtected = review.status === 'locked' || review.status === 'vault';
  const videoUrl = review.videoUrl ?? null;
  const secondVideoUrl = review.secondReviewerVideoUrl ?? null;
  const editHref = `/edit-review/${review.slug}` as const;

  const statusPill =
    review.status === 'published'
      ? { label: 'Published', bg: tw.emerald100, color: tw.emerald700 }
      : review.status === 'locked'
        ? { label: 'Locked', bg: tw.amber100, color: tw.amber700 }
        : review.status === 'vault'
          ? { label: 'Vault', bg: tw.violet100, color: tw.violet700 }
          : { label: 'Draft', bg: fg(0.1), color: fg(0.6) };

  return (
    <Card shadow>
      <View style={styles.top}>
        <View style={styles.thumb}>
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {review.thumbnailUrl && (
            <Image source={{ uri: review.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Display size="lg" numberOfLines={1}>
            {review.title}
          </Display>
          <T size="xs" color={fg(0.6)} numberOfLines={1}>
            {review.store} · {review.city} · {review.rating}/10
          </T>
          <T size="xs" color={fg(0.5)} numberOfLines={1} style={{ marginTop: 4 }}>
            {review.categories.join(', ')}
          </T>
          <View style={styles.pills}>
            <Pill {...statusPill} />
            <Pill
              label={review.videoKey ? 'Video uploaded' : 'No video'}
              bg={review.videoKey ? tw.emerald100 : fg(0.1)}
              color={review.videoKey ? tw.emerald700 : fg(0.5)}
            />
            {review.excludeFromRankings && (
              <Pill label="Excluded from rankings" bg={tw.red100} color={tw.red700} />
            )}
          </View>
        </View>
      </View>

      {/* View counts — real (actual visitors) vs. the padded number the public sees. */}
      <Divider />
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        {editingViews ? (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <T size="xs" weight="semibold" color={fg(0.7)}>
                Set an exact number
              </T>
              <View style={styles.wrapRow}>
                <Input
                  value={viewsInput}
                  onChangeText={setViewsInput}
                  keyboardType="number-pad"
                  style={{ width: 144, paddingVertical: 6 }}
                />
                <Button
                  variant="primary"
                  label="Save number"
                  style={{ paddingVertical: 6 }}
                  disabled={busy}
                  onPress={() => postViews({ action: 'fixed', value: Number(viewsInput) || 0 })}
                />
              </View>
            </View>

            <View style={styles.editorSection}>
              <T size="xs" weight="semibold" color={fg(0.7)}>
                Auto-climb to a target (like YouTube)
              </T>
              <T size="xs11" color={fg(0.5)}>
                Climbs fast at first, then slows down, maxing out at the target. It keeps going on its
                own — no need to touch it again. Each video starts with its own target so they don&apos;t
                all land on the same number.
              </T>
              <View style={styles.wrapRow}>
                <T size="xs" weight="semibold" color={fg(0.6)}>
                  Max out at
                </T>
                <Input
                  value={climbTarget}
                  onChangeText={setClimbTarget}
                  keyboardType="number-pad"
                  style={{ width: 112, paddingVertical: 6 }}
                />
                <Button
                  label="🎲 Random"
                  style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                  onPress={() => setClimbTarget(String(randomClimbTarget()))}
                />
                <Button
                  variant="accent"
                  style={{ paddingVertical: 6 }}
                  disabled={busy}
                  label={viewSetting?.mode === 'auto' ? 'Restart climb' : 'Start climbing'}
                  onPress={() =>
                    postViews({ action: 'climb', from: publicViews, target: Number(climbTarget) || 0 })
                  }
                />
              </View>
            </View>

            <View style={[styles.wrapRow, styles.editorFooter]}>
              <Button
                label="Reset to automatic"
                style={{ paddingVertical: 6 }}
                disabled={busy}
                onPress={() => postViews({ action: 'reset' })}
              />
              <Pressable
                disabled={busy}
                onPress={() => {
                  setViewsInput(String(publicViews));
                  setEditingViews(false);
                }}
              >
                <T size="xs" weight="semibold" color={fg(0.5)}>
                  Cancel
                </T>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.viewsRow}>
            <View style={styles.viewsCounts}>
              <T size="xs" color={fg(0.7)}>
                <T size="xs" weight="semibold">
                  {formatViewsFull(views)}
                </T>{' '}
                real {views === 1 ? 'view' : 'views'}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T size="xs" color={fg(0.7)}>
                  <T size="xs" weight="semibold">
                    {formatViewsFull(publicViews)}
                  </T>{' '}
                  shown publicly
                </T>
                {viewSetting?.mode === 'fixed' && <SmallTag label="custom" />}
                {viewSetting?.mode === 'auto' && (
                  <SmallTag label={`climbing → ${formatViewsFull(viewSetting.target)}`} />
                )}
              </View>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setViewsInput(String(publicViews));
                setEditingViews(true);
              }}
            >
              <T size="xs" weight="semibold" color={colors.primary}>
                Edit views
              </T>
            </Pressable>
          </View>
        )}
      </View>

      <Divider />
      <View style={{ padding: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Edit" style={styles.gridBtn} onPress={() => router.push(editHref)} />
          {isProtected ? (
            <Button label="Change" style={styles.gridBtn} onPress={() => router.push(editHref)} />
          ) : (
            <Button
              label={review.status === 'published' ? 'Make Private' : 'Publish'}
              style={styles.gridBtn}
              disabled={busy}
              onPress={togglePublish}
            />
          )}
          <Button
            label="Delete"
            variant="outlinePrimary"
            style={styles.gridBtn}
            disabled={busy}
            onPress={handleDelete}
          />
        </View>
        <Button
          label={review.excludeFromRankings ? '✓ Excluded from rankings' : 'Include in rankings'}
          style={[
            { paddingVertical: 8 },
            review.excludeFromRankings && { borderColor: tw.red300, backgroundColor: tw.red50 },
          ]}
          color={review.excludeFromRankings ? tw.red700 : undefined}
          disabled={busy}
          onPress={toggleRankingExclusion}
        />
      </View>

      {(videoUrl || secondVideoUrl) && (
        <>
          <Divider />
          <View style={[styles.wrapRow, { paddingHorizontal: 12, paddingVertical: 10 }]}>
            <T size="xs" weight="semibold" color={fg(0.4)}>
              Download:
            </T>
            {videoUrl && (
              <Button
                label={secondVideoUrl ? `${review.reviewer}'s video` : 'Video'}
                style={styles.downloadBtn}
                icon={<DownloadIcon />}
                onPress={() => Linking.openURL(videoUrl)}
              />
            )}
            {secondVideoUrl && (
              <Button
                label={`${review.secondReviewer}'s video`}
                style={styles.downloadBtn}
                icon={<DownloadIcon />}
                onPress={() => Linking.openURL(secondVideoUrl)}
              />
            )}
          </View>
        </>
      )}
    </Card>
  );
}

function SmallTag({ label }: { label: string }) {
  return (
    <View style={styles.smallTag}>
      <T size="xs10" weight="semibold" color={colors.accent}>
        {label}
      </T>
    </View>
  );
}

function DownloadIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={fg(0.7)} strokeWidth={2}>
      <Path
        d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  top: { flexDirection: 'row', gap: 12, padding: 16 },
  thumb: { width: 112, height: 64, borderRadius: 8, overflow: 'hidden' },
  pills: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  editorSection: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  editorFooter: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  viewsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  viewsCounts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4, flexShrink: 1 },
  smallTag: {
    marginLeft: 4,
    borderRadius: 999,
    backgroundColor: accentA(0.1),
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gridBtn: { flex: 1, paddingHorizontal: 0, paddingVertical: 8 },
  downloadBtn: { paddingHorizontal: 12, paddingVertical: 4 },
});
