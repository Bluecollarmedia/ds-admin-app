import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import MapView, { Marker, type MapPressEvent, type MarkerDragStartEndEvent } from 'react-native-maps';

import { adminFetch } from '@/lib/api';
import { colors } from '@/lib/theme';

type Props = {
  lat?: number;
  lng?: number;
  address?: string;
  onChange: (v: { lat?: number; lng?: number; address?: string }) => void;
};

type Suggestion = { label: string; lat?: number; lng?: number; placeId?: string };

function isLinkOrCoords(s: string) {
  return /^https?:\/\//i.test(s) || /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(s);
}

// Map (tap/drag) + a search box that mirrors the web LocationPicker: typed
// address autocomplete (Google Places, falling back to Photon server-side) and
// pasting a Google Maps link or raw coordinates, both resolved server-side via
// /api/admin/resolve-location.
export function LocationPicker({ lat, lng, address, onChange }: Props) {
  const [query, setQuery] = useState(address ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<string | null>(null);
  const mapRef = useRef<MapView | null>(null);

  function ensureSession() {
    if (!sessionRef.current) {
      sessionRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    }
    return sessionRef.current;
  }

  function place(nlat: number, nlng: number, label?: string) {
    mapRef.current?.animateToRegion({ latitude: nlat, longitude: nlng, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 350);
    onChange({ lat: nlat, lng: nlng, address: label ?? query ?? undefined });
  }

  function onType(value: string) {
    setQuery(value);
    setStatus(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isLinkOrCoords(value) || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const token = ensureSession();
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await adminFetch('/api/admin/resolve-location', {
          method: 'POST',
          body: JSON.stringify({ suggest: true, query: value, sessionToken: token }),
        });
        const data = await res.json();
        setSuggestions(data.results ?? []);
        if (data.error) setStatus(`Search error: ${data.error}`);
      } catch {
        setSuggestions([]);
      }
    }, 280);
  }

  async function pick(s: Suggestion) {
    setQuery(s.label);
    setSuggestions([]);
    if (typeof s.lat === 'number' && typeof s.lng === 'number') {
      place(s.lat, s.lng, s.label);
      setStatus(`Set: ${s.label}`);
    } else if (s.placeId) {
      setStatus('Getting location…');
      try {
        const res = await adminFetch('/api/admin/resolve-location', {
          method: 'POST',
          body: JSON.stringify({ placeId: s.placeId, sessionToken: sessionRef.current }),
        });
        const data = await res.json();
        if (typeof data.lat === 'number') {
          place(data.lat, data.lng, s.label);
          setStatus(`Set: ${s.label}`);
        } else {
          setStatus(data.error ?? "Couldn't get that location.");
        }
      } catch {
        setStatus("Couldn't get that location.");
      }
    }
    sessionRef.current = null;
  }

  async function resolveLink() {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setStatus('Reading link…');
    try {
      const res = await adminFetch('/api/admin/resolve-location', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.lat !== 'number') {
        setStatus(data.error ?? "Couldn't read that link.");
        return;
      }
      place(data.lat, data.lng, data.label ?? q);
      setStatus('Location set from link.');
    } catch {
      setStatus('Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setQuery('');
    setSuggestions([]);
    setStatus(null);
    onChange({ lat: undefined, lng: undefined, address: undefined });
  }

  const hasPin = typeof lat === 'number' && typeof lng === 'number';
  const linkMode = isLinkOrCoords(query);

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={onType}
          placeholder="Type a store name/address, or paste a Google Maps link"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
        />
        {linkMode && (
          <Pressable onPress={resolveLink} disabled={busy} style={styles.useLinkBtn}>
            {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.useLinkText}>Use link</Text>}
          </Pressable>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestBox}>
          {suggestions.map((s, i) => (
            <Pressable key={i} onPress={() => pick(s)} style={styles.suggestRow}>
              <Text style={styles.suggestText} numberOfLines={1}>
                📍 {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: lat ?? 40.09,
            longitude: lng ?? -74.22,
            latitudeDelta: hasPin ? 0.03 : 0.4,
            longitudeDelta: hasPin ? 0.03 : 0.4,
          }}
          onPress={(e: MapPressEvent) => {
            place(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude);
            setStatus('Pin placed.');
          }}
        >
          {hasPin && (
            <Marker
              draggable
              coordinate={{ latitude: lat!, longitude: lng! }}
              onDragEnd={(e: MarkerDragStartEndEvent) => {
                onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude, address: query || undefined });
                setStatus('Pin moved.');
              }}
            />
          )}
        </MapView>
      </View>

      <View style={styles.footRow}>
        <Text style={styles.footNote}>
          {hasPin ? `Pinned: ${lat!.toFixed(5)}, ${lng!.toFixed(5)}` : 'No location set — search, or tap/drag the map.'}
        </Text>
        {hasPin && (
          <Pressable onPress={clear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        )}
      </View>
      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  useLinkBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  useLinkText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  suggestBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden' },
  suggestRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestText: { fontSize: 13, color: colors.foreground },
  mapWrap: { height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  map: { flex: 1 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footNote: { fontSize: 12, color: colors.muted, flex: 1 },
  clear: { fontSize: 12, fontWeight: '700', color: colors.primary },
  status: { fontSize: 12, color: colors.muted },
});
