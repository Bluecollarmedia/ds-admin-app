import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { AsyncList } from '@/components/AsyncList';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { relativeTime } from '@/lib/time';
import { colors } from '@/lib/theme';

type Appeal = {
  id: string;
  name: string;
  contact: string;
  message: string;
  selfieUrl: string | null;
  faceVerified: boolean;
  ip: string;
  geo?: { city?: string; region?: string; country?: string; flag?: string };
  status: 'new' | 'handled';
  createdAt: string;
};

export function AppealsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ appeals: Appeal[] }>(
    '/api/admin/appeals'
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [pins, setPins] = useState<Record<string, string>>({});

  async function act(a: Appeal, action: 'unban' | 'pin' | 'handled' | 'delete') {
    setBusy(a.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await adminFetch('/api/admin/appeals', {
        method: 'POST',
        body: JSON.stringify({ action, id: a.id }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        Alert.alert('Could not do that', d?.error ?? 'Try again.');
        return;
      }
      if (action === 'pin' && d?.pin) {
        setPins((p) => ({ ...p, [a.id]: d.pin }));
      } else {
        refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete(a: Appeal) {
    Alert.alert('Delete appeal', 'Remove this appeal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => act(a, 'delete') },
    ]);
  }

  return (
    <AsyncList
      title="Appeals"
      items={data?.appeals}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      keyExtractor={(a) => a.id}
      emptyText="No appeals yet."
      renderItem={(a) => {
        const place = a.geo ? [a.geo.city, a.geo.region, a.geo.country].filter(Boolean).join(', ') : '';
        return (
          <View style={[styles.card, a.status === 'new' && styles.newCard]}>
            <View style={styles.row}>
              {a.selfieUrl ? (
                <Image source={{ uri: a.selfieUrl }} style={styles.selfie} contentFit="cover" />
              ) : (
                <View style={styles.noPhoto}>
                  <Text style={styles.noPhotoText}>no photo</Text>
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{a.name || 'Someone'}</Text>
                  {a.status === 'new' && <Badge text="New" bg="#fef3c7" fg="#b45309" />}
                  <Badge
                    text={a.faceVerified ? 'Face ✓' : 'Face not verified'}
                    bg={a.faceVerified ? '#d1fae5' : colors.surfaceMuted}
                    fg={a.faceVerified ? '#047857' : colors.muted}
                  />
                </View>
                <Text style={styles.meta}>
                  {relativeTime(a.createdAt)} ago{a.contact ? ` · ${a.contact}` : ''}
                </Text>
                {!!a.message && <Text style={styles.message}>{a.message}</Text>}
                {(place || a.ip) && (
                  <Text style={styles.loc}>
                    {a.geo?.flag ? `${a.geo.flag} ` : '📍 '}
                    {place || 'unknown'} · {a.ip}
                  </Text>
                )}
              </View>
            </View>

            {pins[a.id] && (
              <View style={styles.pinBox}>
                <Text style={styles.pinLabel}>One-time unban code (give this to them):</Text>
                <Text style={styles.pin}>{pins[a.id]}</Text>
                <Text style={styles.pinNote}>Good for 24 hours, works once.</Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable onPress={() => act(a, 'unban')} disabled={busy === a.id} style={({ pressed }) => [styles.btn, styles.unbanBtn, pressed && styles.pressed]}>
                <Text style={styles.unbanText}>Unban</Text>
              </Pressable>
              <Pressable onPress={() => act(a, 'pin')} disabled={busy === a.id} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
                <Text style={styles.btnText}>Code</Text>
              </Pressable>
              {a.status === 'new' && (
                <Pressable onPress={() => act(a, 'handled')} disabled={busy === a.id} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
                  <Text style={styles.btnText}>Handled</Text>
                </Pressable>
              )}
              <Pressable onPress={() => confirmDelete(a)} disabled={busy === a.id} style={({ pressed }) => [styles.btn, styles.deleteBtn, pressed && styles.pressed]}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 12 },
  newCard: { borderColor: colors.primary },
  row: { flexDirection: 'row', gap: 12 },
  selfie: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  noPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: { fontSize: 11, color: colors.muted },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.muted },
  message: { fontSize: 14, color: colors.foreground, marginTop: 2 },
  loc: { fontSize: 11, color: colors.muted, marginTop: 2 },
  pinBox: { backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, alignItems: 'center' },
  pinLabel: { fontSize: 12, color: colors.muted },
  pin: { fontSize: 26, fontWeight: '800', letterSpacing: 4, color: colors.foreground, marginTop: 4 },
  pinNote: { fontSize: 11, color: colors.muted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  unbanBtn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  unbanText: { fontSize: 13, fontWeight: '700', color: colors.white },
  deleteBtn: { borderColor: colors.primary },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.7 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800' },
});
