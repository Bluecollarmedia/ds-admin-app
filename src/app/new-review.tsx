import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import MapView, { Marker, type MapPressEvent, type MarkerDragStartEndEvent } from 'react-native-maps';

import { Header } from '@/components/Header';
import { adminFetch } from '@/lib/api';
import { uploadToR2 } from '@/lib/upload';
import { colors } from '@/lib/theme';

const CATEGORIES = ['Pizza', 'Dairy', 'Meat', 'Desserts', 'Drinks'];
const REVIEWERS = ['David', 'Shmuel'];
const STATUSES: { value: 'published' | 'draft' | 'locked' | 'vault'; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'locked', label: 'Locked' },
  { value: 'vault', label: 'Vault' },
];

type Asset = ImagePicker.ImagePickerAsset;

export default function NewReview() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [store, setStore] = useState('');
  const [city, setCity] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [rating, setRating] = useState('8');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [reviewer, setReviewer] = useState('David');
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [status, setStatus] = useState<'published' | 'draft' | 'locked' | 'vault'>('draft');
  const [video, setVideo] = useState<Asset | null>(null);
  const [thumbnail, setThumbnail] = useState<Asset | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  function toggleCategory(c: string) {
    Haptics.selectionAsync();
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick a video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (!res.canceled) setVideo(res.assets[0]);
  }

  async function pickThumbnail() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick a thumbnail.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (!res.canceled) setThumbnail(res.assets[0]);
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

    setSaving(true);
    try {
      let thumbnailKey: string | undefined;
      if (thumbnail) {
        setProgress('Uploading thumbnail…');
        thumbnailKey = await uploadToR2(
          thumbnail.uri,
          thumbnail.fileName ?? 'thumbnail.jpg',
          thumbnail.mimeType ?? 'image/jpeg',
          'thumbnails'
        );
      }
      let videoKey: string | undefined;
      if (video) {
        setProgress('Uploading video… (keep the app open)');
        videoKey = await uploadToR2(
          video.uri,
          video.fileName ?? 'video.mp4',
          video.mimeType ?? 'video/mp4',
          'videos'
        );
      }

      setProgress('Saving…');
      const res = await adminFetch('/api/admin/reviews', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          store: store.trim(),
          city: city.trim(),
          categories,
          rating: parseFloat(rating) || 0,
          price: price.trim() || undefined,
          description: description.trim(),
          reviewer: finalReviewer,
          status,
          videoKey,
          thumbnailKey,
          lat: coords?.lat,
          lng: coords?.lng,
        }),
      });
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
    <View style={styles.root}>
      <Header title="New Review" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Video title">
          <TextInput value={title} onChangeText={setTitle} placeholder='e.g. "This Pizza Almost Made Us Fight"' placeholderTextColor={colors.muted} style={styles.input} />
        </Field>
        <View style={styles.two}>
          <Field label="Store" style={styles.flex1}>
            <TextInput value={store} onChangeText={setStore} style={styles.input} placeholderTextColor={colors.muted} />
          </Field>
          <Field label="City" style={styles.flex1}>
            <TextInput value={city} onChangeText={setCity} style={styles.input} placeholderTextColor={colors.muted} />
          </Field>
        </View>

        <Field label="Categories">
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} active={categories.includes(c)} onPress={() => toggleCategory(c)} />
            ))}
          </View>
        </Field>

        <View style={styles.two}>
          <Field label="Rating (1-10)" style={styles.flex1}>
            <TextInput value={rating} onChangeText={setRating} keyboardType="decimal-pad" style={styles.input} />
          </Field>
          <Field label="Price (optional)" style={styles.flex1}>
            <TextInput value={price} onChangeText={setPrice} placeholder="$, $$, $12.99" placeholderTextColor={colors.muted} style={styles.input} />
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
            <TextInput value={guestName} onChangeText={setGuestName} placeholder="Guest's name" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: 8 }]} />
          )}
        </Field>

        <Field label="Description">
          <TextInput value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} />
        </Field>

        <Field label="Video">
          <Pressable onPress={pickVideo} style={styles.dropzone}>
            <Text style={styles.dropTitle}>{video ? 'Change video' : 'Tap to pick a video'}</Text>
            <Text style={styles.dropSub}>{video ? video.fileName ?? 'Selected' : 'From your phone'}</Text>
          </Pressable>
        </Field>

        <Field label="Thumbnail">
          {thumbnail && <Image source={{ uri: thumbnail.uri }} style={styles.thumbPreview} contentFit="cover" />}
          <Pressable onPress={pickThumbnail} style={styles.dropzone}>
            <Text style={styles.dropTitle}>{thumbnail ? 'Change thumbnail' : 'Tap to pick a thumbnail'}</Text>
            <Text style={styles.dropSub}>Cropped to 16:9</Text>
          </Pressable>
        </Field>

        <Field label="Location (optional)">
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={{ latitude: 40.09, longitude: -74.22, latitudeDelta: 0.4, longitudeDelta: 0.4 }}
              onPress={(e: MapPressEvent) => {
                Haptics.selectionAsync();
                setCoords({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
              }}
            >
              {coords && (
                <Marker
                  draggable
                  coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                  onDragEnd={(e: MarkerDragStartEndEvent) =>
                    setCoords({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
                  }
                />
              )}
            </MapView>
          </View>
          <View style={styles.mapFoot}>
            <Text style={styles.mapNote}>
              {coords ? `Pinned: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Tap the map to drop a pin'}
            </Text>
            {coords && (
              <Pressable onPress={() => setCoords(null)} hitSlop={8}>
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            )}
          </View>
        </Field>

        <Field label="Visibility">
          <View style={styles.chips}>
            {STATUSES.map((st) => (
              <Chip key={st.value} label={st.label} active={status === st.value} onPress={() => { Haptics.selectionAsync(); setStatus(st.value); }} />
            ))}
          </View>
        </Field>

        <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.saveText}>{progress || 'Saving…'}</Text>
            </View>
          ) : (
            <Text style={styles.saveText}>Create Review</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  field: { gap: 6 },
  two: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  label: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  chipTextActive: { color: colors.white },
  dropzone: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
  },
  dropTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  dropSub: { fontSize: 12, color: colors.muted },
  thumbPreview: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 8, backgroundColor: colors.surfaceMuted },
  mapWrap: { height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  map: { flex: 1 },
  mapFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  mapNote: { fontSize: 12, color: colors.muted },
  clear: { fontSize: 12, fontWeight: '700', color: colors.primary },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
