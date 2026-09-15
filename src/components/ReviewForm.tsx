import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { Field, Chip, inputStyle } from './FormFields';
import { LocationPicker } from './LocationPicker';
import { NativeImageCropper } from './NativeImageCropper';
import { CommentsPanel } from './CommentsPanel';
import { adminFetch } from '@/lib/api';
import { uploadToR2 } from '@/lib/upload';
import { useAdminData } from '@/lib/useAdminData';
import { colors } from '@/lib/theme';

const CATEGORIES = ['Pizza', 'Dairy', 'Meat', 'Desserts', 'Drinks'];
const REVIEWERS = ['David', 'Shmuel'];
const STATUSES: { value: Status; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'locked', label: 'Locked' },
  { value: 'vault', label: 'Vault' },
];

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
  lat?: number;
  lng?: number;
  mapAddress?: string;
};

type Slot = 'main' | 'second' | 'third';

type MediaState = {
  videoAsset: ImagePicker.ImagePickerAsset | null;
  thumbnailUri: string | null; // locally cropped, ready to upload
  existingThumbnailUrl?: string | null;
  existingVideoKey?: string;
};

const EMPTY_MEDIA: MediaState = { videoAsset: null, thumbnailUri: null };

export function ReviewForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: ReviewDetail }) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [store, setStore] = useState(initial?.store ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [rating, setRating] = useState(initial?.rating?.toString() ?? '8');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [reviewer, setReviewer] = useState(initial?.reviewer ?? REVIEWERS[0]);
  const [isGuest, setIsGuest] = useState(initial ? !REVIEWERS.includes(initial.reviewer) : false);
  const [guestName, setGuestName] = useState(
    initial && !REVIEWERS.includes(initial.reviewer) ? initial.reviewer : ''
  );
  const [status, setStatus] = useState<Status>(initial?.status ?? 'draft');

  const [main, setMain] = useState<MediaState>({
    ...EMPTY_MEDIA,
    existingVideoKey: initial?.videoKey,
    existingThumbnailUrl: initial?.thumbnailUrl,
  });

  const [hasSecond, setHasSecond] = useState(!!initial?.secondReviewer);
  const [secondReviewer, setSecondReviewer] = useState(initial?.secondReviewer ?? '');
  const [isSecondGuest, setIsSecondGuest] = useState(
    initial?.secondReviewer ? !REVIEWERS.includes(initial.secondReviewer) : false
  );
  const [secondGuestName, setSecondGuestName] = useState(
    initial?.secondReviewer && !REVIEWERS.includes(initial.secondReviewer) ? initial.secondReviewer : ''
  );
  const [secondRating, setSecondRating] = useState(initial?.secondReviewerRating?.toString() ?? '');
  const [second, setSecond] = useState<MediaState>({
    ...EMPTY_MEDIA,
    existingVideoKey: initial?.secondReviewerVideoKey,
    existingThumbnailUrl: initial?.secondReviewerThumbnailUrl,
  });
  const [showBothScores, setShowBothScores] = useState(initial?.showBothScores ?? false);

  const [hasThird, setHasThird] = useState(!!initial?.thirdReviewer);
  const [thirdReviewer, setThirdReviewer] = useState(initial?.thirdReviewer ?? '');
  const [isThirdGuest, setIsThirdGuest] = useState(
    initial?.thirdReviewer ? !REVIEWERS.includes(initial.thirdReviewer) : false
  );
  const [thirdGuestName, setThirdGuestName] = useState(
    initial?.thirdReviewer && !REVIEWERS.includes(initial.thirdReviewer) ? initial.thirdReviewer : ''
  );
  const [thirdRating, setThirdRating] = useState(initial?.thirdReviewerRating?.toString() ?? '');
  const [third, setThird] = useState<MediaState>({
    ...EMPTY_MEDIA,
    existingVideoKey: initial?.thirdReviewerVideoKey,
    existingThumbnailUrl: initial?.thirdReviewerThumbnailUrl,
  });

  const [location, setLocation] = useState<{ lat?: number; lng?: number; address?: string }>({
    lat: initial?.lat,
    lng: initial?.lng,
    address: initial?.mapAddress,
  });

  // Optional link to an earlier review (a revisit/follow-up).
  const [originalReviewSlug, setOriginalReviewSlug] = useState(initial?.originalReviewSlug ?? '');
  const [showLinkPicker, setShowLinkPicker] = useState(!!initial?.originalReviewSlug);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: allReviewsData } = useAdminData<{ reviews: { slug: string; title: string }[] }>(
    '/api/admin/reviews'
  );
  const pickableReviews = (allReviewsData?.reviews ?? []).filter((r) => r.slug !== initial?.slug);
  const linkedTitle = pickableReviews.find((r) => r.slug === originalReviewSlug)?.title;

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  // A Locked/Vault review's visibility is frozen unless the security passcode
  // has been entered this session — mirrors the web guard.
  const isProtected = initial?.status === 'locked' || initial?.status === 'vault';
  const [visibilityLocked, setVisibilityLocked] = useState(false);
  useEffect(() => {
    if (mode !== 'edit' || !isProtected) return;
    adminFetch('/api/admin/settings').then((res) => setVisibilityLocked(!res.ok));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cropper: only one open at a time, targeting whichever slot triggered it.
  const [cropperTarget, setCropperTarget] = useState<Slot | null>(null);
  const [cropperAsset, setCropperAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  function toggleCategory(c: string) {
    Haptics.selectionAsync();
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function pickVideo(setter: (m: MediaState | ((p: MediaState) => MediaState)) => void) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick a video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (!res.canceled) setter((p) => ({ ...p, videoAsset: res.assets[0] }));
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
    const setter = cropperTarget === 'main' ? setMain : cropperTarget === 'second' ? setSecond : setThird;
    setter((p) => ({ ...p, thumbnailUri: uri }));
    setCropperTarget(null);
    setCropperAsset(null);
  }

  async function uploadSlot(m: MediaState): Promise<{ videoKey?: string; thumbnailKey?: string }> {
    let videoKey = m.existingVideoKey;
    if (m.videoAsset) {
      videoKey = await uploadToR2(
        m.videoAsset.uri,
        m.videoAsset.fileName ?? 'video.mp4',
        m.videoAsset.mimeType ?? 'video/mp4',
        'videos'
      );
    }
    let thumbnailKey: string | undefined;
    if (m.thumbnailUri) {
      thumbnailKey = await uploadToR2(m.thumbnailUri, 'thumbnail.jpg', 'image/jpeg', 'thumbnails');
    }
    return { videoKey, thumbnailKey };
  }

  async function save() {
    if (!title.trim() || !store.trim() || !city.trim() || !description.trim()) {
      Alert.alert('Missing info', 'Fill in title, store, city and description.');
      return;
    }
    if (categories.length === 0) {
      Alert.alert('Pick a category', 'Choose at least one category.');
      return;
    }
    const finalReviewer = isGuest ? guestName.trim() : reviewer;
    if (!finalReviewer) {
      Alert.alert('Reviewer', "Enter the guest reviewer's name.");
      return;
    }
    const finalSecond = hasSecond ? (isSecondGuest ? secondGuestName.trim() : secondReviewer) : '';
    if (hasSecond && !finalSecond) {
      Alert.alert('Second reviewer', 'Pick or name the second reviewer.');
      return;
    }
    const finalThird = hasThird ? (isThirdGuest ? thirdGuestName.trim() : thirdReviewer) : '';
    if (hasThird && !finalThird) {
      Alert.alert('Third reviewer', 'Pick or name the third reviewer.');
      return;
    }

    setSaving(true);
    try {
      setProgress('Uploading main media…');
      const mainUp = await uploadSlot(main);
      let secondUp: { videoKey?: string; thumbnailKey?: string } = {};
      if (hasSecond) {
        setProgress(`Uploading ${finalSecond}'s media…`);
        secondUp = await uploadSlot(second);
      }
      let thirdUp: { videoKey?: string; thumbnailKey?: string } = {};
      if (hasThird) {
        setProgress(`Uploading ${finalThird}'s media…`);
        thirdUp = await uploadSlot(third);
      }

      setProgress('Saving…');
      const payload = {
        title: title.trim(),
        store: store.trim(),
        city: city.trim(),
        categories,
        rating: parseFloat(rating) || 0,
        price: price.trim() || undefined,
        description: description.trim(),
        reviewer: finalReviewer,
        status,
        // Keep the existing key when no new file was picked (edit mode);
        // undefined on create, since there's nothing existing yet.
        videoKey: mainUp.videoKey ?? initial?.videoKey,
        thumbnailKey: mainUp.thumbnailKey ?? initial?.thumbnailKey,
        secondReviewer: hasSecond ? finalSecond : undefined,
        secondReviewerVideoKey: hasSecond ? secondUp.videoKey ?? initial?.secondReviewerVideoKey : undefined,
        secondReviewerThumbnailKey: hasSecond
          ? secondUp.thumbnailKey ?? initial?.secondReviewerThumbnailKey
          : undefined,
        secondReviewerRating: hasSecond && secondRating ? parseFloat(secondRating) : undefined,
        thirdReviewer: hasThird ? finalThird : undefined,
        thirdReviewerVideoKey: hasThird ? thirdUp.videoKey ?? initial?.thirdReviewerVideoKey : undefined,
        thirdReviewerThumbnailKey: hasThird
          ? thirdUp.thumbnailKey ?? initial?.thirdReviewerThumbnailKey
          : undefined,
        thirdReviewerRating: hasThird && thirdRating ? parseFloat(thirdRating) : undefined,
        showBothScores: hasSecond ? showBothScores : false,
        originalReviewSlug: originalReviewSlug || undefined,
        lat: location.lat,
        lng: location.lng,
        mapAddress: location.address,
      };

      const url = mode === 'create' ? '/api/admin/reviews' : `/api/admin/reviews/${initial!.slug}`;
      const res = await adminFetch(url, { method: mode === 'create' ? 'POST' : 'PUT', body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? 'Could not save.');
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
      setProgress('');
    }
  }

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

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Video title">
          <TextInput value={title} onChangeText={setTitle} placeholder='e.g. "This Pizza Almost Made Us Fight"' placeholderTextColor={colors.muted} style={inputStyle} />
        </Field>
        <View style={styles.two}>
          <Field label="Store" style={styles.flex1}>
            <TextInput value={store} onChangeText={setStore} style={inputStyle} />
          </Field>
          <Field label="City" style={styles.flex1}>
            <TextInput value={city} onChangeText={setCity} style={inputStyle} />
          </Field>
        </View>

        <Field label="Store location (map)">
          <LocationPicker lat={location.lat} lng={location.lng} address={location.address} onChange={setLocation} />
        </Field>

        <Field label="Categories">
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} active={categories.includes(c)} onPress={() => toggleCategory(c)} />
            ))}
          </View>
        </Field>

        <View style={styles.two}>
          <Field label="Rating (1-10)" style={styles.flex1}>
            <TextInput value={rating} onChangeText={setRating} keyboardType="decimal-pad" style={inputStyle} />
          </Field>
          <Field label="Price (optional)" style={styles.flex1}>
            <TextInput value={price} onChangeText={setPrice} placeholder="$, $$, $12.99" placeholderTextColor={colors.muted} style={inputStyle} />
          </Field>
        </View>

        <Field label="Reviewer">
          <View style={styles.chips}>
            {REVIEWERS.map((r) => (
              <Chip key={r} label={r} active={!isGuest && reviewer === r} onPress={() => { Haptics.selectionAsync(); setIsGuest(false); setReviewer(r); }} />
            ))}
            <Chip label="Guest" active={isGuest} onPress={() => { Haptics.selectionAsync(); setIsGuest(true); }} />
          </View>
          {isGuest && (
            <TextInput value={guestName} onChangeText={setGuestName} placeholder="Guest's name" placeholderTextColor={colors.muted} style={[inputStyle, { marginTop: 8 }]} />
          )}
        </Field>

        <ToggleField
          label="Add a second reviewer"
          sub="Two people reviewed this same video — viewers get a switch between them."
          value={hasSecond}
          onChange={(v) => {
            setHasSecond(v);
            if (!v) {
              setSecondReviewer('');
              setIsSecondGuest(false);
              setSecondGuestName('');
            }
          }}
        />
        {hasSecond && (
          <View style={styles.subSection}>
            <Field label="Second reviewer">
              <View style={styles.chips}>
                {REVIEWERS.filter((r) => r !== reviewer).map((r) => (
                  <Chip key={r} label={r} active={!isSecondGuest && secondReviewer === r} onPress={() => { Haptics.selectionAsync(); setIsSecondGuest(false); setSecondReviewer(r); }} />
                ))}
                <Chip label="Guest" active={isSecondGuest} onPress={() => { Haptics.selectionAsync(); setIsSecondGuest(true); }} />
              </View>
              {isSecondGuest && (
                <TextInput value={secondGuestName} onChangeText={setSecondGuestName} placeholder="Guest's name" placeholderTextColor={colors.muted} style={[inputStyle, { marginTop: 8 }]} />
              )}
            </Field>
            <Field label="Second reviewer's rating (optional)">
              <TextInput value={secondRating} onChangeText={setSecondRating} keyboardType="decimal-pad" placeholder="Leave blank to reuse the first rating" placeholderTextColor={colors.muted} style={inputStyle} />
            </Field>
            <ToggleField label="Show both scores on the card" value={showBothScores} onChange={setShowBothScores} compact />
            <MediaUploadFields
              label={secondReviewer || secondGuestName || 'Second reviewer'}
              media={second}
              onPickVideo={() => pickVideo(setSecond)}
              onPickThumbnail={() => pickThumbnail('second')}
            />
          </View>
        )}

        {hasSecond && (
          <ToggleField
            label="Add a third reviewer"
            sub="Three people reviewed this same video."
            value={hasThird}
            onChange={(v) => {
              setHasThird(v);
              if (!v) {
                setThirdReviewer('');
                setIsThirdGuest(false);
                setThirdGuestName('');
              }
            }}
          />
        )}
        {hasSecond && hasThird && (
          <View style={styles.subSection}>
            <Field label="Third reviewer">
              <View style={styles.chips}>
                {REVIEWERS.filter((r) => r !== reviewer && r !== secondReviewer).map((r) => (
                  <Chip key={r} label={r} active={!isThirdGuest && thirdReviewer === r} onPress={() => { Haptics.selectionAsync(); setIsThirdGuest(false); setThirdReviewer(r); }} />
                ))}
                <Chip label="Guest" active={isThirdGuest} onPress={() => { Haptics.selectionAsync(); setIsThirdGuest(true); }} />
              </View>
              {isThirdGuest && (
                <TextInput value={thirdGuestName} onChangeText={setThirdGuestName} placeholder="Guest's name" placeholderTextColor={colors.muted} style={[inputStyle, { marginTop: 8 }]} />
              )}
            </Field>
            <Field label="Third reviewer's rating (optional)">
              <TextInput value={thirdRating} onChangeText={setThirdRating} keyboardType="decimal-pad" placeholder="Leave blank to reuse the first rating" placeholderTextColor={colors.muted} style={inputStyle} />
            </Field>
            <MediaUploadFields
              label={thirdReviewer || thirdGuestName || 'Third reviewer'}
              media={third}
              onPickVideo={() => pickVideo(setThird)}
              onPickThumbnail={() => pickThumbnail('third')}
            />
          </View>
        )}

        <Field label="Description">
          <TextInput value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.muted} style={[inputStyle, styles.multiline]} />
        </Field>

        {showLinkPicker ? (
          <Field label="Follow-up to an earlier review?">
            <Text style={styles.linkNote}>Pick the review this one revisits. Both pages will show a link between them.</Text>
            <Pressable onPress={() => setPickerOpen(true)} style={styles.pickerBtn}>
              <Text style={styles.pickerBtnText}>{linkedTitle ?? '— None (standalone review) —'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setOriginalReviewSlug('');
                setShowLinkPicker(false);
              }}
              style={{ marginTop: 6 }}
            >
              <Text style={styles.linkCancel}>Cancel</Text>
            </Pressable>
          </Field>
        ) : (
          <Pressable onPress={() => setShowLinkPicker(true)}>
            <Text style={styles.linkToggle}>↩ Link this to an earlier review (a revisit) — optional</Text>
          </Pressable>
        )}

        <ReviewPickerModal
          visible={pickerOpen}
          reviews={pickableReviews}
          selectedSlug={originalReviewSlug}
          onSelect={(slug) => {
            setOriginalReviewSlug(slug);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />

        <Field label={hasSecond ? `${reviewer || 'Main'}'s video & thumbnail` : 'Video & thumbnail'}>
          <MediaUploadFields
            media={main}
            onPickVideo={() => pickVideo(setMain)}
            onPickThumbnail={() => pickThumbnail('main')}
          />
        </Field>

        <Field label="Visibility">
          {visibilityLocked ? (
            <View style={styles.lockedBox}>
              <Text style={styles.lockedText}>
                This video is {initial?.status === 'vault' ? 'in the Vault' : 'Locked'}. Enter the security passcode
                in Settings to change its visibility.
              </Text>
            </View>
          ) : (
            <View style={styles.chips}>
              {STATUSES.map((st) => (
                <Chip key={st.value} label={st.label} active={status === st.value} onPress={() => { Haptics.selectionAsync(); setStatus(st.value); }} />
              ))}
            </View>
          )}
        </Field>

        <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.saveText}>{progress || 'Saving…'}</Text>
            </View>
          ) : (
            <Text style={styles.saveText}>{mode === 'create' ? 'Create Review' : 'Save Changes'}</Text>
          )}
        </Pressable>

        {mode === 'edit' && initial?.slug && <CommentsPanel slug={initial.slug} />}
      </ScrollView>
    </>
  );
}

function ToggleField({
  label,
  sub,
  value,
  onChange,
  compact,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onChange(!value);
      }}
      style={[styles.toggleRow, compact && styles.toggleRowCompact]}
    >
      <View style={[styles.checkbox, value && styles.checkboxOn]}>{value && <Text style={styles.checkMark}>✓</Text>}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub && <Text style={styles.toggleSub}>{sub}</Text>}
      </View>
    </Pressable>
  );
}

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
          <Text style={styles.modalTitle}>Pick a review to link</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search titles…"
            placeholderTextColor={colors.muted}
            style={[inputStyle, { marginTop: 10 }]}
          />
          <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => onSelect('')} style={styles.modalRow}>
              <Text style={styles.modalRowText}>— None (standalone review) —</Text>
            </Pressable>
            {filtered.map((r) => (
              <Pressable key={r.slug} onPress={() => onSelect(r.slug)} style={styles.modalRow}>
                <Text style={[styles.modalRowText, r.slug === selectedSlug && styles.modalRowActive]} numberOfLines={1}>
                  {r.title}
                </Text>
              </Pressable>
            ))}
            {filtered.length === 0 && <Text style={styles.modalEmpty}>No matching reviews.</Text>}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MediaUploadFields({
  label,
  media,
  onPickVideo,
  onPickThumbnail,
}: {
  label?: string;
  media: MediaState;
  onPickVideo: () => void;
  onPickThumbnail: () => void;
}) {
  const thumbPreview = media.thumbnailUri ?? media.existingThumbnailUrl ?? null;
  return (
    <View style={{ gap: 14 }}>
      <View>
        <Text style={styles.mediaLabel}>{label ? `${label}'s video` : 'Video'}</Text>
        <Pressable onPress={onPickVideo} style={styles.dropzone}>
          <Text style={styles.dropTitle}>
            {media.videoAsset ? 'Change video' : media.existingVideoKey ? 'Replace video' : 'Tap to pick a video'}
          </Text>
          <Text style={styles.dropSub}>
            {media.videoAsset?.fileName ?? (media.existingVideoKey ? 'A video is already uploaded ✓' : 'From your phone')}
          </Text>
        </Pressable>
      </View>
      <View>
        <Text style={styles.mediaLabel}>{label ? `${label}'s thumbnail` : 'Thumbnail'}</Text>
        {thumbPreview && <Image source={{ uri: thumbPreview }} style={styles.thumbPreview} contentFit="cover" />}
        <Pressable onPress={onPickThumbnail} style={styles.dropzone}>
          <Text style={styles.dropTitle}>{thumbPreview ? 'Change thumbnail' : 'Tap to pick a thumbnail'}</Text>
          <Text style={styles.dropSub}>Pinch/drag to crop to 16:9</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linkToggle: { fontSize: 12, fontWeight: '600', color: colors.muted, textDecorationLine: 'underline' },
  linkNote: { fontSize: 12, color: colors.muted },
  linkCancel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  pickerBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, marginTop: 4 },
  pickerBtnText: { fontSize: 14, color: colors.foreground },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '75%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  modalList: { marginTop: 12 },
  modalRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalRowText: { fontSize: 14, color: colors.foreground },
  modalRowActive: { color: colors.primary, fontWeight: '700' },
  modalEmpty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 20 },
  modalCloseBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  modalCloseText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  two: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  subSection: { gap: 14, backgroundColor: colors.surfaceMuted, borderRadius: 14, padding: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  toggleRowCompact: { paddingVertical: 0 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.white, fontSize: 13, fontWeight: '800' },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  toggleSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  mediaLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 6 },
  dropzone: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
  },
  dropTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  dropSub: { fontSize: 12, color: colors.muted },
  thumbPreview: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 8, backgroundColor: colors.surfaceMuted },
  lockedBox: { backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 14 },
  lockedText: { fontSize: 13, color: colors.foreground },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
