import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { AsyncList } from '@/components/AsyncList';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { relativeTime } from '@/lib/time';
import { colors } from '@/lib/theme';

type Location = { ip: string; geo?: { city?: string; region?: string; country?: string; flag?: string; isp?: string }; count: number };
type Visitor = { id: string; label?: string; count: number; lastSeen: string; locations?: Location[] };
type VisitorsData = { visitors: Visitor[]; hidden: string[]; bannedIps: string[]; banMessage: string };

function placeLabel(loc?: Location): string {
  if (!loc) return '';
  if (!loc.geo) return loc.ip;
  const place = [loc.geo.city, loc.geo.region, loc.geo.country].filter(Boolean).join(', ');
  return `${loc.geo.flag ? loc.geo.flag + ' ' : ''}${place || loc.ip}`;
}

export function VisitorsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<VisitorsData>('/api/admin/visitors');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const hidden = new Set(data?.hidden ?? []);
  const banned = new Set(data?.bannedIps ?? []);
  const isBanned = (v: Visitor) => banned.has(v.id) || (v.locations ?? []).some((l) => banned.has(l.ip));

  async function post(body: Record<string, unknown>) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await adminFetch('/api/admin/visitors', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) Alert.alert('Could not do that', 'Try again.');
    return res.ok;
  }

  async function saveLabel(v: Visitor) {
    setBusy(v.id);
    const ok = await post({ action: 'label', id: v.id, label: labelInput });
    setEditing(null);
    setBusy(null);
    if (ok) refresh();
  }

  async function action(v: Visitor, act: 'hide' | 'unhide' | 'clear', confirm?: string) {
    const run = async () => {
      setBusy(v.id);
      const ok = await post({ action: act, id: v.id });
      setBusy(null);
      if (ok) refresh();
    };
    if (confirm) {
      Alert.alert('Confirm', confirm, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: run },
      ]);
    } else run();
  }

  async function toggleBan(v: Visitor) {
    const ips = (v.locations ?? []).map((l) => l.ip);
    if (isBanned(v)) {
      setBusy(v.id);
      const ok = await post({ action: 'unban', id: v.id, ips });
      setBusy(null);
      if (ok) refresh();
    } else {
      Alert.alert('Ban device', "They'll see your ban message on every page.", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            setBusy(v.id);
            const ok = await post({ action: 'ban', id: v.id, ips });
            setBusy(null);
            if (ok) refresh();
          },
        },
      ]);
    }
  }

  async function saveBanMessage() {
    if (message === null) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await adminFetch('/api/admin/visitors', {
      method: 'POST',
      body: JSON.stringify({ action: 'ban-message', message }),
    });
    if (res.ok) {
      setMessage(null);
      refresh();
    }
  }

  const visible = (data?.visitors ?? []).filter((v) => !hidden.has(v.id));

  return (
    <AsyncList
      title="Visitors"
      items={visible}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      keyExtractor={(v) => v.id}
      emptyText="No visitors logged yet."
      listHeader={
        data ? (
          <View style={styles.msgBox}>
            <Text style={styles.msgLabel}>Message shown to banned visitors</Text>
            <TextInput
              value={message ?? data.banMessage}
              onChangeText={setMessage}
              multiline
              placeholder="e.g. You've been blocked."
              placeholderTextColor={colors.muted}
              style={styles.msgInput}
            />
            {message !== null && message !== data.banMessage && (
              <Pressable onPress={saveBanMessage} style={styles.msgSave}>
                <Text style={styles.msgSaveText}>Save message</Text>
              </Pressable>
            )}
            <Text style={styles.count}>
              {data.visitors.length} {data.visitors.length === 1 ? 'device' : 'devices'} logged
            </Text>
          </View>
        ) : undefined
      }
      renderItem={(v) => {
        const primary = v.locations?.[0];
        return (
          <View style={styles.card}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{v.label || 'Visitor'}</Text>
              {isBanned(v) && (
                <View style={styles.bannedBadge}>
                  <Text style={styles.bannedText}>Banned</Text>
                </View>
              )}
            </View>
            <Text style={styles.meta}>
              Last seen {relativeTime(v.lastSeen)} ago · {v.count} {v.count === 1 ? 'visit' : 'visits'}
            </Text>
            {primary && <Text style={styles.loc}>{placeLabel(primary)}</Text>}
            {(v.locations?.length ?? 0) > 1 && (
              <Text style={styles.locNote}>Seen from {v.locations!.length} IPs/places</Text>
            )}

            {editing === v.id ? (
              <View style={styles.editRow}>
                <TextInput
                  value={labelInput}
                  onChangeText={setLabelInput}
                  placeholder="e.g. Me, Shmuel, Mom..."
                  placeholderTextColor={colors.muted}
                  style={styles.editInput}
                  autoFocus
                />
                <Pressable onPress={() => saveLabel(v)} style={styles.saveBtn}>
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setEditing(null)} hitSlop={8}>
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Act
                  label={v.label ? 'Rename' : 'Name it'}
                  onPress={() => {
                    setLabelInput(v.label ?? '');
                    setEditing(v.id);
                  }}
                />
                <Act label="Hide" onPress={() => action(v, 'hide')} />
                <Act label={isBanned(v) ? 'Unban' : 'Ban'} danger={!isBanned(v)} onPress={() => toggleBan(v)} />
                <Act label="Delete" onPress={() => action(v, 'clear', "Delete this device's history?")} />
              </View>
            )}
            {busy === v.id && <Text style={styles.working}>Working…</Text>}
          </View>
        );
      }}
    />
  );
}

function Act({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      <Text style={[styles.act, danger && styles.actDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  msgBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 14, gap: 8 },
  msgLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  msgInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  msgSave: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  msgSaveText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  count: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  bannedBadge: { backgroundColor: '#fde2e6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  bannedText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  meta: { fontSize: 12, color: colors.muted },
  loc: { fontSize: 13, color: colors.foreground, marginTop: 2 },
  locNote: { fontSize: 11, color: colors.muted },
  actions: { flexDirection: 'row', gap: 18, marginTop: 8, flexWrap: 'wrap' },
  act: { fontSize: 13, fontWeight: '700', color: colors.muted },
  actDanger: { color: colors.primary },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  editInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, backgroundColor: colors.background },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  cancel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  working: { fontSize: 11, color: colors.muted, marginTop: 4 },
});
