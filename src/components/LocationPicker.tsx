import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import MapView, { Marker, type MapPressEvent, type MarkerDragStartEndEvent } from 'react-native-maps';
import Svg, { Circle, Path } from 'react-native-svg';

import { T } from './ui';
import { adminFetch } from '@/lib/api';
import { colors, fg, fonts } from '@/lib/theme';

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
          onSubmitEditing={() => {
            if (linkMode) resolveLink();
            else if (suggestions[0]) pick(suggestions[0]);
          }}
          placeholder="Type a store name or address, or paste a Google Maps link"
          placeholderTextColor={fg(0.4)}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {linkMode && (
          <Pressable onPress={resolveLink} disabled={busy} style={[styles.useLinkBtn, busy && { opacity: 0.6 }]}>
            <T size="sm" weight="semibold" color={colors.white}>
              {busy ? '…' : 'Use link'}
            </T>
          </Pressable>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestBox}>
          {suggestions.map((s, i) => (
            <Pressable key={i} onPress={() => pick(s)} style={styles.suggestRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} style={{ marginTop: 2 }}>
                <Path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={11} r={2.5} />
              </Svg>
              <T size="sm" style={{ flex: 1 }}>
                {s.label}
              </T>
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
        <T size="xs" color={fg(0.55)} style={{ flex: 1 }}>
          {hasPin
            ? `Pinned: ${lat!.toFixed(5)}, ${lng!.toFixed(5)} — drag the pin to fine-tune`
            : 'No location set — type to search, or drag/tap the map.'}
        </T>
        {hasPin && (
          <Pressable onPress={clear} hitSlop={8}>
            <T size="xs" weight="semibold" color={colors.primary}>
              Clear
            </T>
          </Pressable>
        )}
      </View>
      {status && (
        <T size="xs" color={fg(0.5)}>
          {status}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  useLinkBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  suggestBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  suggestRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  mapWrap: { height: 224, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  map: { flex: 1 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
