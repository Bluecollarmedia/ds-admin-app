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
  lockedSet: boolean;
  vaultSet: boolean;
  settingsSet: boolean;
};

type PassMode = 'keep' | 'change' | 'remove';

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

  // Locked / Vault / Security passcodes — never shown, only Set/Change/Remove.
  const [lockedMode, setLockedMode] = useState<PassMode>('keep');
  const [vaultMode, setVaultMode] = useState<PassMode>('keep');
  const [settingsMode, setSettingsMode] = useState<PassMode>('keep');
  const [lockedValue, setLockedValue] = useState('');
  const [vaultValue, setVaultValue] = useState('');
  const [settingsValue, setSettingsValue] = useState('');

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

  function passcodePayload(mode: PassMode, value: string): { include: boolean; value: string } {
    if (mode === 'change' && value.trim()) return { include: true, value: value.trim() };
    if (mode === 'remove') return { include: true, value: '' };
    return { include: false, value: '' };
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    setSaved(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const body: Record<string, unknown> = {
      emailNotifications: s.emailNotifications,
      notifyEmail: s.notifyEmail,
      bannerMessage: s.bannerMessage,
      bannerDuration: 'none',
      siteLockMode: s.siteLockMode,
      siteLockPasscode: s.siteLockPasscode,
      siteLockPasscode2: s.siteLockPasscode2,
      siteLockHint: s.siteLockHint,
      requireApproval: s.requireApproval,
    };
    const locked = passcodePayload(lockedMode, lockedValue);
    const vault = passcodePayload(vaultMode, vaultValue);
    const security = passcodePayload(settingsMode, settingsValue);
    if (locked.include) body.lockedPasscode = locked.value;
    if (vault.include) body.vaultPasscode = vault.value;
    if (security.include) body.settingsPasscode = security.value;

    const res = await adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setS((prev) =>
        prev
          ? {
              ...prev,
              lockedSet: lockedMode === 'change' ? true : lockedMode === 'remove' ? false : prev.lockedSet,
              vaultSet: vaultMode === 'change' ? true : vaultMode === 'remove' ? false : prev.vaultSet,
              settingsSet: settingsMode === 'change' ? true : settingsMode === 'remove' ? false : prev.settingsSet,
            }
          : prev
      );
      setLockedMode('keep');
      setVaultMode('keep');
      setSettingsMode('keep');
      setLockedValue('');
      setVaultValue('');
      setSettingsValue('');
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

          <Card title="Video passcodes · advanced">
            <Text style={styles.passcodeIntro}>
              The codes that unlock your hidden videos. For safety the current codes are never shown — set a
              new one to change it.
            </Text>
            <PasscodeField
              label="Locked passcode"
              description="Opens the regular Locked section."
              isSet={s.lockedSet}
              mode={lockedMode}
              value={lockedValue}
              onMode={setLockedMode}
              onValue={setLockedValue}
            />
            <PasscodeField
              label="Vault passcode"
              description="The second, deeper code — for videos inside the Vault."
              isSet={s.vaultSet}
              mode={vaultMode}
              value={vaultValue}
              onMode={setVaultMode}
              onValue={setVaultValue}
            />
            <PasscodeField
              label="Security passcode"
              description="Guards this section and the other protected tabs. Remove it to leave them open."
              isSet={s.settingsSet}
              mode={settingsMode}
              value={settingsValue}
              onMode={setSettingsMode}
              onValue={setSettingsValue}
            />
          </Card>

          <View style={styles.saveRow}>
            <Pressable onPress={save} disabled={saving} style={styles.primaryBtn}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Save all settings</Text>}
            </Pressable>
            {saved && <Text style={styles.savedText}>Saved ✓</Text>}
          </View>
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
function PasscodeField({
  label,
  description,
  isSet,
  mode,
  value,
  onMode,
  onValue,
}: {
  label: string;
  description: string;
  isSet: boolean;
  mode: PassMode;
  value: string;
  onMode: (m: PassMode) => void;
  onValue: (v: string) => void;
}) {
  return (
    <View style={styles.passcodeBox}>
      <View style={styles.passcodeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.passcodeLabel}>{label}</Text>
          <Text style={styles.passcodeDesc}>{description}</Text>
        </View>
        {mode === 'keep' && (
          <View style={[styles.passcodeBadge, isSet ? styles.passcodeBadgeOn : styles.passcodeBadgeOff]}>
            <Text style={[styles.passcodeBadgeText, { color: isSet ? '#047857' : colors.muted }]}>
              {isSet ? 'Set' : 'Not set'}
            </Text>
          </View>
        )}
      </View>

      {mode === 'keep' ? (
        <View style={styles.passcodeActions}>
          <Pressable onPress={() => onMode('change')} style={styles.passcodeGhostBtn}>
            <Text style={styles.passcodeGhostText}>{isSet ? 'Change' : 'Set a passcode'}</Text>
          </Pressable>
          {isSet && (
            <Pressable onPress={() => onMode('remove')} style={styles.passcodeRemoveBtn}>
              <Text style={styles.passcodeRemoveText}>Remove</Text>
            </Pressable>
          )}
        </View>
      ) : mode === 'change' ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={value}
              onChangeText={onValue}
              placeholder={`New ${label.toLowerCase()}`}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable
              onPress={() => {
                onMode('keep');
                onValue('');
              }}
              style={{ justifyContent: 'center' }}
            >
              <Text style={styles.passcodeCancel}>Cancel</Text>
            </Pressable>
          </View>
          <Text style={styles.passcodeNote}>Takes effect when you save.</Text>
        </View>
      ) : (
        <View style={styles.passcodeActions}>
          <Text style={styles.passcodeWillRemove}>Will be removed when you save.</Text>
          <Pressable onPress={() => onMode('keep')}>
            <Text style={styles.passcodeCancel}>Undo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
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
  passcodeIntro: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  passcodeBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.background },
  passcodeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  passcodeLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  passcodeDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  passcodeBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  passcodeBadgeOn: { backgroundColor: '#d1fae5' },
  passcodeBadgeOff: { backgroundColor: colors.surfaceMuted },
  passcodeBadgeText: { fontSize: 10, fontWeight: '800' },
  passcodeActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  passcodeGhostBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  passcodeGhostText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  passcodeRemoveBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  passcodeRemoveText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  passcodeCancel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  passcodeNote: { fontSize: 11, color: colors.muted },
  passcodeWillRemove: { fontSize: 12, fontWeight: '700', color: colors.primary },
});
