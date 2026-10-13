import { useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { LocationPicker } from './LocationPicker';
import { NativeImageCropper } from './NativeImageCropper';
import { Button, Input, T } from './ui';
import { adminFetch } from '@/lib/api';
import { uploadSmallThumbnail, uploadToR2 } from '@/lib/upload';
import { useAdminData } from '@/lib/useAdminData';
import { colors, fg, primaryA, tw } from '@/lib/theme';

// Same lists as the website's lib/data.ts.
const CATEGORIES = ['Pizza', 'Dairy', 'Meat', 'Desserts', 'Drinks'];
const CITIES = ['Lakewood', 'Toms River', 'Deal', 'Brooklyn'];
const REVIEWERS = ['David', 'Shmuel'];
const PRICES = ['$', '$$', '$$$'];

type Status = 'published' | 'draft' | 'locked' | 'vault';

export type ReviewDetail = {
  slug: string;
  title: string;
  store: string;
  city: string;
  rating: number;
  price?: string;
  categories: string[];
  description: string;
  reviewer: string;
  status: Status;
  videoKey?: string;
  thumbnailKey?: string;
  thumbnailUrl?: string | null;
  secondReviewer?: string;
  secondReviewerVideoKey?: string;
  secondReviewerThumbnailKey?: string;
  secondReviewerThumbnailUrl?: string | null;
  secondReviewerRating?: number;
  thirdReviewer?: string;
  thirdReviewerVideoKey?: string;
  thirdReviewerThumbnailKey?: string;
  thirdReviewerThumbnailUrl?: string | null;
  thirdReviewerRating?: number;
  showBothScores?: boolean;
  originalReviewSlug?: string;
  durationSeconds?: number;
  excludeFromRankings?: boolean;
  lat?: number;
  lng?: number;
  mapAddress?: string;
};

type Slot = 'main' | 'second' | 'third';

type MediaState = {
  videoAsset: ImagePicker.ImagePickerAsset | null;
  videoKey?: string; // already uploaded
  thumbnailUri: string | null; // cropped locally, not uploaded yet
  thumbnailKey?: string; // already uploaded
  videoProgress: number | null;
  thumbnailProgress: number | null;
};

function media(videoKey?: string, thumbnailKey?: string): MediaState {
  return { videoAsset: null, videoKey, thumbnailUri: null, thumbnailKey, videoProgress: null, thumbnailProgress: null };
}

// The website's admin ReviewForm, field for field and in the same order.
export function ReviewForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: ReviewDetail }) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [store, setStore] = useState(initial?.store ?? '');
  const [city, setCity] = useState(initial?.city ?? CITIES[0]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initial?.categories ?? []);
  const [rating, setRating] = useState(initial?.rating?.toString() ?? '8');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [originalReviewSlug, setOriginalReviewSlug] = useState(initial?.originalReviewSlug ?? '');
  const [showLinkPicker, setShowLinkPicker] = useState(!!initial?.originalReviewSlug);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewer, setReviewer] = useState(initial?.reviewer ?? REVIEWERS[0]);
  const [isGuestReviewer, setIsGuestReviewer] = useState(initial ? !REVIEWERS.includes(initial.reviewer) : false);
  const [guestName, setGuestName] = useState(initial && !REVIEWERS.includes(initial.reviewer) ? initial.reviewer : '');
  // The app has full access, so visibility is always editable (no passcode).
  const [status, setStatus] = useState<Status>(initial?.status ?? 'draft');
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(initial?.durationSeconds);
  const [location, setLocation] = useState<{ lat?: number; lng?: number; address?: string }>({
    lat: initial?.lat,
    lng: initial?.lng,
    address: initial?.mapAddress,
  });

  const [main, setMain] = useState<MediaState>(media(initial?.videoKey, initial?.thumbnailKey));

  const [hasSecondReviewer, setHasSecondReviewer] = useState(!!initial?.secondReviewer);
  const [secondReviewer, setSecondReviewer] = useState(initial?.secondReviewer ?? '');
  const [isSecondGuestReviewer, setIsSecondGuestReviewer] = useState(
    initial?.secondReviewer ? !REVIEWERS.includes(initial.secondReviewer) : false
  );
  const [secondGuestName, setSecondGuestName] = useState(
    initial?.secondReviewer && !REVIEWERS.includes(initial.secondReviewer) ? initial.secondReviewer : ''
  );
  const [showBothScores, setShowBothScores] = useState(initial?.showBothScores ?? false);
  const [secondReviewerRating, setSecondReviewerRating] = useState(initial?.secondReviewerRating?.toString() ?? '');
  const [second, setSecond] = useState<MediaState>(
    media(initial?.secondReviewerVideoKey, initial?.secondReviewerThumbnailKey)
  );

  const [hasThirdReviewer, setHasThirdReviewer] = useState(!!initial?.thirdReviewer);
  const [thirdReviewer, setThirdReviewer] = useState(initial?.thirdReviewer ?? '');
  const [isThirdGuestReviewer, setIsThirdGuestReviewer] = useState(
    initial?.thirdReviewer ? !REVIEWERS.includes(initial.thirdReviewer) : false
  );
  const [thirdGuestName, setThirdGuestName] = useState(
    initial?.thirdReviewer && !REVIEWERS.includes(initial.thirdReviewer) ? initial.thirdReviewer : ''
  );
  const [thirdReviewerRating, setThirdReviewerRating] = useState(initial?.thirdReviewerRating?.toString() ?? '');
  const [third, setThird] = useState<MediaState>(
    media(initial?.thirdReviewerVideoKey, initial?.thirdReviewerThumbnailKey)
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: allReviewsData } = useAdminData<{ reviews: { slug: string; title: string }[] }>('/api/admin/reviews');
  const allReviews = (allReviewsData?.reviews ?? []).filter((r) => r.slug !== initial?.slug);
  const linkedTitle = allReviews.find((r) => r.slug === originalReviewSlug)?.title;

  // One cropper at a time, for whichever slot asked for it.
  const [cropperTarget, setCropperTarget] = useState<Slot | null>(null);
  const [cropperAsset, setCropperAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const setters = { main: setMain, second: setSecond, third: setThird };

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  async function pickVideo(slot: Slot) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick a video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled) return;
    const asset = res.assets[0];
    setters[slot]((p) => ({ ...p, videoAsset: asset }));
    // The picker already knows the length (in ms), so the card gets its badge.
    if (slot === 'main' && asset.duration && asset.duration > 0) {
      setDurationSeconds(Math.round(asset.duration / 1000));
    }
  }

  async function pickThumbnail(slot: Slot) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick a thumbnail.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled) {
      setCropperAsset(res.assets[0]);
      setCropperTarget(slot);
    }
  }

  function onCropConfirm(uri: string) {
    if (cropperTarget) setters[cropperTarget]((p) => ({ ...p, thumbnailUri: uri }));
    setCropperTarget(null);
    setCropperAsset(null);
  }

  // Upload whatever is new in one slot (thumbnail first, like the website) and
  // return the keys to save.
  async function uploadSlot(slot: Slot, m: MediaState): Promise<{ videoKey?: string; thumbnailKey?: string }> {
    const set = setters[slot];
    let thumbnailKey = m.thumbnailKey;
    if (m.thumbnailUri) {
      set((p) => ({ ...p, thumbnailProgress: 0 }));
      thumbnailKey = await uploadToR2(m.thumbnailUri, 'thumbnail.jpg', 'image/jpeg', 'thumbnails', (n) =>
        set((p) => ({ ...p, thumbnailProgress: n }))
      );
      // Not fatal: the site falls back to the full image if the small copy is missing.
      await uploadSmallThumbnail(m.thumbnailUri, thumbnailKey).catch(() => {});
      set((p) => ({ ...p, thumbnailKey, thumbnailProgress: null }));
    }
    let videoKey = m.videoKey;
    if (m.videoAsset) {
      set((p) => ({ ...p, videoProgress: 0 }));
      videoKey = await uploadToR2(
        m.videoAsset.uri,
        m.videoAsset.fileName ?? 'video.mp4',
        m.videoAsset.mimeType ?? 'video/mp4',
        'videos',
        (n) => set((p) => ({ ...p, videoProgress: n }))
      );
      set((p) => ({ ...p, videoKey, videoProgress: null }));
    }
    return { videoKey, thumbnailKey };
  }

  async function handleSubmit() {
    if (!title.trim() || !store.trim() || !city.trim() || !description.trim() || !rating.trim()) {
      setError('Fill in the title, store, city, rating and description.');
      return;
    }
    if (selectedCategories.length === 0) {
      setError('Pick at least one category.');
      return;
    }
    if (isGuestReviewer && !guestName.trim()) {
      setError("Enter the guest reviewer's name.");
      return;
    }
    if (hasSecondReviewer && isSecondGuestReviewer && !secondGuestName.trim()) {
      setError("Enter the second reviewer's name.");
      return;
    }
    if (hasSecondReviewer && !secondReviewer.trim()) {
      setError('Pick who the second reviewer is.');
      return;
    }
    if (hasThirdReviewer && isThirdGuestReviewer && !thirdGuestName.trim()) {
      setError("Enter the third reviewer's name.");
      return;
    }
    if (hasThirdReviewer && !thirdReviewer.trim()) {
      setError('Pick who the third reviewer is.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const mainUp = await uploadSlot('main', main);
      const secondUp = hasSecondReviewer ? await uploadSlot('second', second) : {};
      const thirdUp = hasThirdReviewer ? await uploadSlot('third', third) : {};

      const payload = {
        title: title.trim(),
        store: store.trim(),
        city: city.trim(),
        categories: selectedCategories,
        rating: parseFloat(rating),
        price: price.trim() || undefined,
        description: description.trim(),
        reviewer: reviewer.trim(),
        status,
        videoKey: mainUp.videoKey,
        thumbnailKey: mainUp.thumbnailKey,
        secondReviewer: hasSecondReviewer ? secondReviewer.trim() : undefined,
        secondReviewerVideoKey: hasSecondReviewer ? secondUp.videoKey : undefined,
        secondReviewerThumbnailKey: hasSecondReviewer ? secondUp.thumbnailKey : undefined,
        secondReviewerRating:
          hasSecondReviewer && secondReviewerRating ? parseFloat(secondReviewerRating) : undefined,
        thirdReviewer: hasThirdReviewer ? thirdReviewer.trim() : undefined,
        thirdReviewerVideoKey: hasThirdReviewer ? thirdUp.videoKey : undefined,
        thirdReviewerThumbnailKey: hasThirdReviewer ? thirdUp.thumbnailKey : undefined,
        thirdReviewerRating: hasThirdReviewer && thirdReviewerRating ? parseFloat(thirdReviewerRating) : undefined,
        showBothScores: hasSecondReviewer ? showBothScores : false,
        originalReviewSlug: originalReviewSlug || undefined,
        durationSeconds,
        // Saving replaces the whole review, so carry the rankings switch over.
        excludeFromRankings: initial?.excludeFromRankings,
        lat: location.lat,
        lng: location.lng,
        mapAddress: location.address,
      };

      const url = mode === 'create' ? '/api/admin/reviews' : `/api/admin/reviews/${initial!.slug}`;
      const res = await adminFetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Something went wrong');
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissTo('/reviews');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
      for (const set of Object.values(setters)) set((p) => ({ ...p, videoProgress: null, thumbnailProgress: null }));
    }
  }

  // Same wording as the website's submit button while it works.
  const active = [main, second, third].find((m) => m.thumbnailProgress !== null || m.videoProgress !== null);
  const submitLabel = submitting
    ? active?.thumbnailProgress != null
      ? `Uploading thumbnail... ${active.thumbnailProgress}%`
      : active?.videoProgress != null
        ? `Uploading video... ${active.videoProgress}%`
        : 'Saving...'
    : mode === 'create'
      ? 'Create Review'
      : 'Save Changes';

  return (
    <>
      {cropperTarget && cropperAsset && (
        <NativeImageCropper
          uri={cropperAsset.uri}
          naturalWidth={cropperAsset.width}
          naturalHeight={cropperAsset.height}
          onConfirm={onCropConfirm}
          onCancel={() => {
            setCropperTarget(null);
            setCropperAsset(null);
          }}
        />
      )}

      <View style={{ gap: 24 }}>
        <View style={styles.howTo}>
          <T size="sm" weight="bold">
            How to add a review
          </T>
          <T size="sm" color={fg(0.7)} style={{ marginTop: 4 }}>
            Fill in the details below. Near the bottom, tap the boxes to upload the video and a thumbnail photo. When
            you&apos;re done, hit the big red button at the very bottom to save it.
          </T>
        </View>

        <View>
          <Label>Video title</Label>
          <Input value={title} onChangeText={setTitle} placeholder='e.g. "This Pizza Almost Made Us Fight"' />
        </View>

        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Label>Store name</Label>
            <Input value={store} onChangeText={setStore} />
          </View>
          <View style={{ flex: 1 }}>
            <Label>City / Town</Label>
            <SuggestInput
              value={city}
              onChangeText={setCity}
              suggestions={CITIES}
              placeholder="Pick a suggestion or type any town"
            />
          </View>
        </View>

        <View>
          <Label>Store location (map)</Label>
          <T size="xs" color={fg(0.55)} style={{ marginBottom: 8 }}>
            Paste the store&apos;s Google Maps link (from the app&apos;s Share button) or type its name/address, hit
            Find, then fine-tune the pin. This is what shows on the Map.
          </T>
          <LocationPicker lat={location.lat} lng={location.lng} address={location.address} onChange={setLocation} />
        </View>

        <View>
          <Label>Categories (pick all that apply)</Label>
          <View style={styles.chips}>
            {CATEGORIES.map((cat) => (
              <Chip key={cat} label={cat} active={selectedCategories.includes(cat)} onPress={() => toggleCategory(cat)} />
            ))}
          </View>
        </View>

        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Label>Rating (1-10)</Label>
            <Input value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Price (optional)</Label>
            <SuggestInput value={price} onChangeText={setPrice} suggestions={PRICES} placeholder="e.g. $, $$, or $12.99" />
          </View>
        </View>

        <View>
          <Label>Reviewer</Label>
          <View style={styles.chips}>
            {REVIEWERS.map((r) => (
              <Chip
                key={r}
                tone="accent"
                label={r}
                active={!isGuestReviewer && reviewer === r}
                onPress={() => {
                  setIsGuestReviewer(false);
                  setReviewer(r);
                }}
              />
            ))}
            <Chip
              tone="accent"
              label="Guest Reviewer"
              active={isGuestReviewer}
              onPress={() => {
                setIsGuestReviewer(true);
                setReviewer(guestName);
              }}
            />
          </View>
          {isGuestReviewer && (
            <Input
              value={guestName}
              onChangeText={(v) => {
                setGuestName(v);
                setReviewer(v);
              }}
              placeholder="Guest's name"
              style={styles.narrow}
            />
          )}
        </View>

        <View>
          <Checkbox
            checked={hasSecondReviewer}
            onChange={(checked) => {
              setHasSecondReviewer(checked);
              if (!checked) {
                setSecondReviewer('');
                setIsSecondGuestReviewer(false);
                setSecondGuestName('');
              }
            }}
            label="Add a second reviewer (two people reviewed this same video)"
          />
          {hasSecondReviewer && (
            <>
              <T size="xs" color={fg(0.5)} style={{ marginBottom: 8 }}>
                Pick who else reviewed this. Viewers will get a switch between the two reviewers on the video page.
              </T>
              <View style={styles.chips}>
                {REVIEWERS.filter((r) => r !== reviewer).map((r) => (
                  <Chip
                    key={r}
                    tone="accent"
                    label={r}
                    active={!isSecondGuestReviewer && secondReviewer === r}
                    onPress={() => {
                      setIsSecondGuestReviewer(false);
                      setSecondReviewer(r);
                    }}
                  />
                ))}
                <Chip
                  tone="accent"
                  label="Guest Reviewer"
                  active={isSecondGuestReviewer}
                  onPress={() => {
                    setIsSecondGuestReviewer(true);
                    setSecondReviewer(secondGuestName);
                  }}
                />
              </View>
              {isSecondGuestReviewer && (
                <Input
                  value={secondGuestName}
                  onChangeText={(v) => {
                    setSecondGuestName(v);
                    setSecondReviewer(v);
                  }}
                  placeholder="Guest's name"
                  style={styles.narrow}
                />
              )}
              <View style={{ marginTop: 12 }}>
                <Label>{secondReviewer ? `${secondReviewer}'s rating (1-10)` : "Second reviewer's rating (1-10)"}</Label>
                <Input
                  value={secondReviewerRating}
                  onChangeText={setSecondReviewerRating}
                  keyboardType="decimal-pad"
                  placeholder="Leave blank to reuse the first rating"
                />
              </View>
              <Checkbox
                checked={showBothScores}
                onChange={setShowBothScores}
                plain
                style={{ marginTop: 12 }}
                label={
                  <>
                    Show <T size="sm" weight="bold">both scores</T> on the review card (one for each reviewer). Off by
                    default — the card just shows the first reviewer&apos;s score.
                  </>
                }
              />
            </>
          )}
        </View>

        {hasSecondReviewer && (
          <View>
            <Checkbox
              checked={hasThirdReviewer}
              onChange={(checked) => {
                setHasThirdReviewer(checked);
                if (!checked) {
                  setThirdReviewer('');
                  setIsThirdGuestReviewer(false);
                  setThirdGuestName('');
                }
              }}
              label="Add a third reviewer (three people reviewed this same video)"
            />
            {hasThirdReviewer && (
              <>
                <T size="xs" color={fg(0.5)} style={{ marginBottom: 8 }}>
                  Pick who else reviewed this. Viewers get a switch between all three reviewers on the video page.
                </T>
                <View style={styles.chips}>
                  {REVIEWERS.filter((r) => r !== reviewer && r !== secondReviewer).map((r) => (
                    <Chip
                      key={r}
                      tone="accent"
                      label={r}
                      active={!isThirdGuestReviewer && thirdReviewer === r}
                      onPress={() => {
                        setIsThirdGuestReviewer(false);
                        setThirdReviewer(r);
                      }}
                    />
                  ))}
                  <Chip
                    tone="accent"
                    label="Guest Reviewer"
                    active={isThirdGuestReviewer}
                    onPress={() => {
                      setIsThirdGuestReviewer(true);
                      setThirdReviewer(thirdGuestName);
                    }}
                  />
                </View>
                {isThirdGuestReviewer && (
                  <Input
                    value={thirdGuestName}
                    onChangeText={(v) => {
                      setThirdGuestName(v);
                      setThirdReviewer(v);
                    }}
                    placeholder="Guest's name"
                    style={styles.narrow}
                  />
                )}
                <View style={{ marginTop: 12 }}>
                  <Label>{thirdReviewer ? `${thirdReviewer}'s rating (1-10)` : "Third reviewer's rating (1-10)"}</Label>
                  <Input
                    value={thirdReviewerRating}
                    onChangeText={setThirdReviewerRating}
                    keyboardType="decimal-pad"
                    placeholder="Leave blank to reuse the first rating"
                  />
                </View>
              </>
            )}
          </View>
        )}

        <View>
          <Label>Description</Label>
          <Input value={description} onChangeText={setDescription} multiline style={{ minHeight: 96 }} />
        </View>

        <View>
          {showLinkPicker ? (
            <>
              <Label>Follow-up to an earlier review?</Label>
              <T size="xs" color={fg(0.5)} style={{ marginBottom: 8 }}>
                Pick the review this one revisits. Both pages will show a link between them.
              </T>
              <Pressable onPress={() => setPickerOpen(true)} style={styles.select}>
                <T size="sm" style={{ flex: 1 }} numberOfLines={1}>
                  {linkedTitle ?? '— None (standalone review) —'}
                </T>
                <T size="xs" color={fg(0.5)}>
                  ▾
                </T>
              </Pressable>
              <Pressable
                onPress={() => {
                  setOriginalReviewSlug('');
                  setShowLinkPicker(false);
                }}
                hitSlop={8}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              >
                <T size="xs" weight="semibold" color={fg(0.4)}>
                  Cancel
                </T>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => setShowLinkPicker(true)} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
              <T size="xs" weight="semibold" color={fg(0.4)}>
                ↩ Link this to an earlier review (a revisit) — optional
              </T>
            </Pressable>
          )}
        </View>

        <ReviewPickerModal
          visible={pickerOpen}
          reviews={allReviews}
          selectedSlug={originalReviewSlug}
          onSelect={(slug) => {
            setOriginalReviewSlug(slug);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />

        <MediaUploadFields
          label={hasSecondReviewer ? reviewer : undefined}
          media={main}
          existingThumbnailUrl={initial?.thumbnailUrl}
          onPickVideo={() => pickVideo('main')}
          onPickThumbnail={() => pickThumbnail('main')}
        />

        {hasSecondReviewer && (
          <View>
            <T size="xs" color={fg(0.5)} style={{ marginBottom: 8 }}>
              Optional — only add {secondReviewer || 'the second reviewer'}&apos;s video/thumbnail below if they filmed
              a separate reaction. Viewers will get a switch between the two on the video page.
            </T>
            <MediaUploadFields
              label={secondReviewer || 'Second reviewer'}
              media={second}
              existingThumbnailUrl={initial?.secondReviewerThumbnailUrl}
              onPickVideo={() => pickVideo('second')}
              onPickThumbnail={() => pickThumbnail('second')}
            />
          </View>
        )}

        {hasThirdReviewer && (
          <View>
            <T size="xs" color={fg(0.5)} style={{ marginBottom: 8 }}>
              Optional — only add {thirdReviewer || 'the third reviewer'}&apos;s video/thumbnail below if they filmed a
              separate reaction. Viewers get a switch between all three on the video page.
            </T>
            <MediaUploadFields
              label={thirdReviewer || 'Third reviewer'}
              media={third}
              existingThumbnailUrl={initial?.thirdReviewerThumbnailUrl}
              onPickVideo={() => pickVideo('third')}
              onPickThumbnail={() => pickThumbnail('third')}
            />
          </View>
        )}

        <View>
          <Label>Visibility</Label>
          <View style={styles.chips}>
            <Chip
              label="Published (public)"
              active={status === 'published'}
              activeStyle={{ borderColor: tw.emerald600, backgroundColor: tw.emerald600 }}
              onPress={() => setStatus('published')}
            />
            <Chip
              label="Private / Draft"
              active={status === 'draft'}
              activeStyle={{ borderColor: fg(0.4), backgroundColor: fg(0.1) }}
              activeColor={colors.foreground}
              onPress={() => setStatus('draft')}
            />
            <Chip
              label="Locked (passcode)"
              active={status === 'locked'}
              activeStyle={{ borderColor: colors.accent, backgroundColor: colors.accent }}
              onPress={() => setStatus('locked')}
            />
            <Chip
              label="Vault (2nd passcode)"
              active={status === 'vault'}
              activeStyle={{ borderColor: colors.foreground, backgroundColor: colors.foreground }}
              activeColor={colors.background}
              onPress={() => setStatus('vault')}
            />
          </View>
          {status === 'locked' && (
            <T size="xs" color={fg(0.5)} style={{ marginTop: 8 }}>
              Visible under the site&apos;s &quot;Locked&quot; menu, only to visitors who enter the passcode.
            </T>
          )}
          {status === 'vault' && (
            <T size="xs" color={fg(0.5)} style={{ marginTop: 8 }}>
              Hidden inside the Vault — visitors need the Locked passcode first, then the Vault passcode on top of it.
            </T>
          )}
        </View>

        {!!error && (
          <T size="sm" color={colors.primary}>
            {error}
          </T>
        )}

        <Button
          variant="primary"
          size="sm"
          label={submitLabel}
          disabled={submitting}
          onPress={handleSubmit}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 24, paddingVertical: 10 }}
        />
      </View>
    </>
  );
}

// `mb-1 block text-sm font-semibold text-foreground`
function Label({ children }: { children: ReactNode }) {
  return (
    <T size="sm" weight="semibold" style={{ marginBottom: 4 }}>
      {children}
    </T>
  );
}

// `rounded-full border px-4 py-2 text-sm font-semibold`, red when on (or accent
// for reviewers, or a custom style for the visibility buttons).
function Chip({
  label,
  active,
  onPress,
  tone = 'primary',
  activeStyle,
  activeColor = colors.white,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: 'primary' | 'accent';
  activeStyle?: { borderColor: string; backgroundColor: string };
  activeColor?: string;
}) {
  const on = activeStyle ?? (tone === 'accent'
    ? { borderColor: colors.accent, backgroundColor: colors.accent }
    : { borderColor: colors.primary, backgroundColor: colors.primary });
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, active ? on : styles.chipOff]}
    >
      <T size="sm" weight="semibold" color={active ? activeColor : fg(0.7)}>
        {label}
      </T>
    </Pressable>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  plain,
  style,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  plain?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onChange(!checked);
      }}
      style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 }, style]}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked && (
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={4}>
            <Path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <T size="sm" weight={plain ? 'regular' : 'semibold'} color={plain ? fg(0.8) : colors.foreground} style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

// A text box with tap-to-fill suggestions, like the website's <datalist>.
function SuggestInput({
  value,
  onChangeText,
  suggestions,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const matches = suggestions.filter((s) => s !== value && s.toLowerCase().startsWith(value.trim().toLowerCase()));
  return (
    <View>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {focused && matches.length > 0 && (
        <View style={styles.suggestBox}>
          {matches.map((s) => (
            <Pressable key={s} onPress={() => onChangeText(s)} style={styles.suggestRow}>
              <T size="sm">{s}</T>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const uploadIcon = (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2}>
    <Path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function UploadDropzone({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.dropzone, pressed && { borderColor: colors.primary, backgroundColor: primaryA(0.05) }]}
    >
      <View style={styles.dropIcon}>{uploadIcon}</View>
      <T size="sm" weight="bold" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T size="xs" color={fg(0.5)} style={{ textAlign: 'center' }}>
        {subtitle}
      </T>
    </Pressable>
  );
}

function ProgressBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <T size="sm" weight="semibold">
          {label}
        </T>
        <T size="sm" weight="semibold">
          {percent}%
        </T>
      </View>
      <View style={styles.track}>
        <View style={{ height: '100%', width: `${percent}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function MediaUploadFields({
  label,
  media: m,
  existingThumbnailUrl,
  onPickVideo,
  onPickThumbnail,
}: {
  label?: string;
  media: MediaState;
  existingThumbnailUrl?: string | null;
  onPickVideo: () => void;
  onPickThumbnail: () => void;
}) {
  const whose = label ? `${label}'s` : 'the';
  const video = m.videoAsset;
  const sizeMb = video?.fileSize ? ` (${(video.fileSize / 1024 / 1024).toFixed(1)} MB)` : '';
  const preview = m.thumbnailUri ?? existingThumbnailUrl ?? null;
  return (
    <View style={{ gap: 24 }}>
      <View>
        <T size="base" weight="bold" style={{ marginBottom: 4 }}>
          {label ? `Upload ${label}'s video` : 'Upload the video'}
        </T>
        <UploadDropzone
          title={m.videoKey || video ? `Tap here to replace ${whose} video` : `Tap here to upload ${whose} video`}
          subtitle={
            video
              ? `Selected: ${video.fileName ?? 'video'}${sizeMb}`
              : m.videoKey
                ? 'A video is already uploaded ✓'
                : 'The review video file from your phone'
          }
          onPress={onPickVideo}
        />
        <T size="xs" color={fg(0.5)} style={{ marginTop: 6 }}>
          Uploads the file as-is. To shrink big videos, use Compress videos on the Storage tab.
        </T>
        {m.videoProgress !== null && <ProgressBar label="Uploading..." percent={m.videoProgress} color={colors.primary} />}
      </View>

      <View>
        <T size="base" weight="bold" style={{ marginBottom: 4 }}>
          {label ? `Upload ${label}'s thumbnail` : 'Upload a thumbnail'}
        </T>
        {preview && <Image source={{ uri: preview }} style={styles.thumbPreview} contentFit="cover" />}
        <UploadDropzone
          title={
            m.thumbnailKey || m.thumbnailUri
              ? `Tap here to replace ${whose} thumbnail`
              : `Tap here to upload ${label ? `${label}'s` : 'a'} thumbnail image`
          }
          subtitle={m.thumbnailKey && !m.thumbnailUri ? 'A thumbnail is already uploaded ✓' : 'JPG or PNG photo of the food'}
          onPress={onPickThumbnail}
        />
        {m.thumbnailProgress !== null && (
          <ProgressBar label="Uploading..." percent={m.thumbnailProgress} color={colors.accent} />
        )}
      </View>
    </View>
  );
}

// The website uses a dropdown; on a phone that's a sheet with search.
function ReviewPickerModal({
  visible,
  reviews,
  selectedSlug,
  onSelect,
  onClose,
}: {
  visible: boolean;
  reviews: { slug: string; title: string }[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = reviews.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <T size="base" weight="bold">
            Follow-up to an earlier review?
          </T>
          <Input value={query} onChangeText={setQuery} placeholder="Search titles…" style={{ marginTop: 12 }} />
          <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
            {[{ slug: '', title: '— None (standalone review) —' }, ...filtered].map((r) => (
              <Pressable key={r.slug || 'none'} onPress={() => onSelect(r.slug)} style={styles.modalRow}>
                <T
                  size="sm"
                  weight={r.slug === selectedSlug ? 'semibold' : 'regular'}
                  color={r.slug === selectedSlug ? colors.primary : colors.foreground}
                  numberOfLines={1}
                >
                  {r.title}
                </T>
              </Pressable>
            ))}
            {filtered.length === 0 && (
              <T size="sm" color={fg(0.5)} style={{ textAlign: 'center', paddingVertical: 20 }}>
                No matching reviews.
              </T>
            )}
          </ScrollView>
          <Button label="Close" onPress={onClose} style={{ marginTop: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  howTo: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
  },
  grid2: { flexDirection: 'row', gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  chipOff: { borderColor: colors.border, backgroundColor: colors.surface },
  narrow: { marginTop: 8, maxWidth: 320 },
  box: {
    marginTop: 2,
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: fg(0.4),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  suggestRow: { paddingHorizontal: 12, paddingVertical: 8 },
  dropzone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  dropIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: primaryA(0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  thumbPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  modalRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
});
