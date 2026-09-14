import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { Header } from '@/components/Header';
import { ApiError, adminFetch, adminJson, unlockSettings } from '@/lib/api';
import { colors } from '@/lib/theme';

type Settings = {
  emailNotifications: boolean;
  notifyEmail: string;
  bannerMessage: string;
  siteLockMode: 'off' | 'full' | 'code';
  siteLockPasscode: string;
  siteLockPasscode2: string;
  siteLockHint: string;
  requireApproval: boolean;
};

const LOCK_OPTIONS: { value: Settings['siteLockMode']; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'full', label: 'Full lockdown' },
  { value: 'code', label: 'Locked with a code' },
];

export function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminJson<Settings>('/api/admin/settings');
      setS(data);
      setLocked(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setLocked(true);
      else setLocked(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUnlock() {
    setUnlocking(true);
    setUnlockError('');
    try {
      await unlockSettings(passcode.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPasscode('');
      await load();
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setUnlockError(e instanceof Error ? e.message : 'Incorrect passcode.');
    } finally {
      setUnlocking(false);
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    setSaved(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await adminFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        emailNotifications: s.emailNotifications,
        notifyEmail: s.notifyEmail,
        bannerMessage: s.bannerMessage,
        bannerDuration: 'none',
        siteLockMode: s.siteLockMode,
        siteLockPasscode: s.siteLockPasscode,
        siteLockPasscode2: s.siteLockPasscode2,
        siteLockHint: s.siteLockHint,
        requireApproval: s.requireApproval,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <View style={styles.root}>
      <Header title="Settings" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : locked ? (
        <View style={styles.unlockWrap}>
          <Text style={styles.lockTitle}>Enter the security passcode</Text>
          <Text style={styles.lockNote}>Settings is protected by the separate security passcode.</Text>
          <TextInput
            value={passcode}
            onChangeText={setPasscode}
            placeholder="Security passcode"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            onSubmitEditing={handleUnlock}
          />
          {unlockError ? <Text style={styles.err}>{unlockError}</Text> : null}
          <Pressable onPress={handleUnlock} disabled={unlocking} style={styles.primaryBtn}>
            {unlocking ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Unlock</Text>}
          </Pressable>
        </View>
      ) : s ? (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Card title="Notifications">
            <Label>Send my notifications to</Label>
            <TextInput
              value={s.notifyEmail}
              onChangeText={(t) => update('notifyEmail', t)}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <ToggleRow
              label="Also email me about comments"
              value={s.emailNotifications}
              onChange={(v) => update('emailNotifications', v)}
            />
          </Card>

          <Card title="Announcement screen">
            <Label>Message shown to visitors (leave empty to remove)</Label>
            <TextInput
              value={s.bannerMessage}
              onChangeText={(t) => update('bannerMessage', t)}
              placeholder="e.g. New videos paused until Sunday…"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, styles.multiline]}
            />
          </Card>

          <Card title="Members-only">
            <ToggleRow
              label="Require an approved account to view the site"
              value={s.requireApproval}
              onChange={(v) => update('requireApproval', v)}
            />
          </Card>

          <Card title="Lock the whole site">
            {LOCK_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => update('siteLockMode', opt.value)}
                style={[styles.radioRow, s.siteLockMode === opt.value && styles.radioActive]}
              >
                <View style={[styles.radio, s.siteLockMode === opt.value && styles.radioOn]} />
                <Text style={styles.radioLabel}>{opt.label}</Text>
              </Pressable>
            ))}
            {s.siteLockMode === 'code' && (
              <View style={styles.codeFields}>
                <TextInput value={s.siteLockPasscode} onChangeText={(t) => update('siteLockPasscode', t)} placeholder="Passcode 1" placeholderTextColor={colors.muted} autoCapitalize="none" style={styles.input} />
                <TextInput value={s.siteLockPasscode2} onChangeText={(t) => update('siteLockPasscode2', t)} placeholder="Passcode 2 (optional)" placeholderTextColor={colors.muted} autoCapitalize="none" style={styles.input} />
                <TextInput value={s.siteLockHint} onChangeText={(t) => update('siteLockHint', t)} placeholder="Hint (optional)" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
            )}
          </Card>

          <View style={styles.saveRow}>
            <Pressable onPress={save} disabled={saving} style={styles.primaryBtn}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Save all settings</Text>}
            </Pressable>
            {saved && <Text style={styles.savedText}>Saved ✓</Text>}
          </View>
          <Text style={styles.footnote}>Video passcodes can be managed on the web admin.</Text>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Text style={styles.err}>Couldn&apos;t load settings.</Text>
          <Pressable onPress={load} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          onChange(v);
        }}
        trackColor={{ true: colors.primary, false: '#d9d0c2' }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  unlockWrap: { padding: 24, gap: 12 },
  lockTitle: { fontSize: 20, fontWeight: '800', color: colors.foreground, textAlign: 'center', marginTop: 20 },
  lockNote: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { flex: 1, fontSize: 14, color: colors.foreground },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  radioActive: { borderColor: colors.primary, backgroundColor: '#fdf2f4' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.muted },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  radioLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  codeFields: { gap: 10, marginTop: 4 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  savedText: { color: colors.emerald, fontWeight: '700' },
  err: { color: colors.primary, fontSize: 14, textAlign: 'center' },
  footnote: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4 },
});
