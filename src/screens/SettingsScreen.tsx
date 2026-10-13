import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Page } from '@/components/Page';
import { Button, Card, ErrorText, Input, Loading, PageHeading, Pill, T } from '@/components/ui';
import { adminFetch, logout } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { colors, fg, primaryA, tw } from '@/lib/theme';

type BannerDuration = 'none' | '24h' | '1w';
type SiteLockMode = 'off' | 'full' | 'code';
type PassMode = 'keep' | 'change' | 'remove';

type SettingsData = {
  emailNotifications: boolean;
  notifyEmail: string;
  bannerMessage: string;
  bannerExpiresAt: string | null;
  siteLockMode: SiteLockMode;
  siteLockPasscode: string;
  siteLockPasscode2: string;
  siteLockHint: string;
  requireApproval: boolean;
  lockedSet: boolean;
  vaultSet: boolean;
  settingsSet: boolean;
};

// The website's /admin/settings page (AdminSettingsForm). The app always has
// full access, so the video passcodes are never behind the security passcode.
export function SettingsScreen() {
  const { data, loading, error, refresh } = useAdminData<SettingsData>('/api/admin/settings');
  return (
    <Page>
      <PageHeading title="Settings" />
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorText message={error ?? "Couldn't load settings."} onRetry={refresh} />
      ) : (
        <SettingsForm initial={data} />
      )}
    </Page>
  );
}

function SettingsForm({ initial }: { initial: SettingsData }) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = (key: string) => setOpenKey((cur) => (cur === key ? null : key));

  const [emailNotifications, setEmailNotifications] = useState(initial.emailNotifications);
  const [notifyEmail, setNotifyEmail] = useState(initial.notifyEmail);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [bannerMessage, setBannerMessage] = useState(initial.bannerMessage);
  const [bannerDuration, setBannerDuration] = useState<BannerDuration>('none');

  const [siteLockMode, setSiteLockMode] = useState<SiteLockMode>(initial.siteLockMode);
  const [siteLockPasscode, setSiteLockPasscode] = useState(initial.siteLockPasscode);
  const [siteLockPasscode2, setSiteLockPasscode2] = useState(initial.siteLockPasscode2);
  const [siteLockHint, setSiteLockHint] = useState(initial.siteLockHint);
  const [requireApproval, setRequireApproval] = useState(initial.requireApproval);

  const [lockedIsSet, setLockedIsSet] = useState(initial.lockedSet);
  const [vaultIsSet, setVaultIsSet] = useState(initial.vaultSet);
  const [settingsIsSet, setSettingsIsSet] = useState(initial.settingsSet);
  const [lockedMode, setLockedMode] = useState<PassMode>('keep');
  const [vaultMode, setVaultMode] = useState<PassMode>('keep');
  const [settingsMode, setSettingsMode] = useState<PassMode>('keep');
  const [lockedValue, setLockedValue] = useState('');
  const [vaultValue, setVaultValue] = useState('');
  const [settingsValue, setSettingsValue] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  async function sendTestEmail() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await adminFetch('/api/admin/test-email', {
        method: 'POST',
        body: JSON.stringify({ to: notifyEmail }),
      });
      const d = await res.json().catch(() => null);
      if (d?.ok) {
        setTestMsg({ ok: true, text: `Sent to ${d.to}. Check your inbox and spam folder. (From: ${d.from})` });
      } else {
        setTestMsg({ ok: false, text: d?.error ?? "Couldn't send the test email." });
      }
    } catch {
      setTestMsg({ ok: false, text: "Couldn't reach the server." });
    } finally {
      setTesting(false);
    }
  }

  const existingExpiry =
    initial.bannerExpiresAt && new Date(initial.bannerExpiresAt).getTime() > Date.now()
      ? new Date(initial.bannerExpiresAt)
      : null;

  function passcodePayload(mode: PassMode, value: string) {
    if (mode === 'change' && value.trim()) return { include: true, value: value.trim() };
    if (mode === 'remove') return { include: true, value: '' };
    return { include: false, value: '' };
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError('');

    const body: Record<string, unknown> = {
      emailNotifications,
      notifyEmail,
      bannerMessage,
      bannerDuration,
      siteLockMode,
      siteLockPasscode,
      siteLockPasscode2,
      siteLockHint,
      requireApproval,
    };
    const locked = passcodePayload(lockedMode, lockedValue);
    const vault = passcodePayload(vaultMode, vaultValue);
    const security = passcodePayload(settingsMode, settingsValue);
    if (locked.include) body.lockedPasscode = locked.value;
    if (vault.include) body.vaultPasscode = vault.value;
    if (security.include) body.settingsPasscode = security.value;

    try {
      const res = await adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? "Couldn't save. Try again.");
        return;
      }
    } catch {
      setError("Couldn't save. Try again.");
      return;
    } finally {
      setSaving(false);
    }

    if (lockedMode === 'change' && lockedValue.trim()) setLockedIsSet(true);
    if (lockedMode === 'remove') setLockedIsSet(false);
    if (vaultMode === 'change' && vaultValue.trim()) setVaultIsSet(true);
    if (vaultMode === 'remove') setVaultIsSet(false);
    if (settingsMode === 'change' && settingsValue.trim()) setSettingsIsSet(true);
    if (settingsMode === 'remove') setSettingsIsSet(false);
    setLockedMode('keep');
    setVaultMode('keep');
    setSettingsMode('keep');
    setLockedValue('');
    setVaultValue('');
    setSettingsValue('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  }

  const durationOptions: { value: BannerDuration; label: string }[] = [
    { value: 'none', label: 'Until I remove it' },
    { value: '24h', label: '24 hours' },
    { value: '1w', label: '1 week' },
  ];

  const lockOptions: { value: SiteLockMode; label: string; hint: string }[] = [
    { value: 'off', label: 'Off', hint: 'Site open to everyone (normal).' },
    {
      value: 'full',
      label: 'Full lockdown',
      hint: 'Whole site closed — visitors see a friendly “we’ll be right back” screen.',
    },
    { value: 'code', label: 'Locked with a code', hint: 'Visitors need a passcode to get in.' },
  ];

  const notifSummary = notifyEmail ? notifyEmail : 'No email set';
  const bannerSummary = bannerMessage.trim() ? 'Showing a message' : 'None';
  const lockSummary =
    siteLockMode === 'full' ? 'Full lockdown' : siteLockMode === 'code' ? 'Locked with a code' : 'Off · site open to everyone';
  const passSummary = `Locked ${lockedIsSet ? '✓' : '—'} · Vault ${vaultIsSet ? '✓' : '—'} · Security ${
    settingsIsSet ? '✓' : '—'
  }`;

  return (
    <View style={{ marginTop: 24, gap: 12 }}>
      <SettingsSection title="Notifications" summary={notifSummary} isOpen={openKey === 'notif'} onToggle={() => toggle('notif')}>
        <T size="sm" weight="semibold" style={{ marginBottom: 4 }}>
          Send my notifications to
        </T>
        <Input
          value={notifyEmail}
          onChangeText={setNotifyEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
        />
        <T size="xs" color={fg(0.6)} style={{ marginTop: 6 }}>
          New account requests and ban appeals are always emailed here. Save after changing it.
        </T>

        <View style={{ marginTop: 12 }}>
          <Button
            label={testing ? 'Sending…' : 'Send test email'}
            style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
            disabled={testing}
            onPress={sendTestEmail}
          />
          {testMsg && (
            <T size="xs" color={testMsg.ok ? tw.emerald600 : colors.primary} style={{ marginTop: 8 }}>
              {testMsg.text}
            </T>
          )}
        </View>

        <View style={[styles.switchRow, styles.topBorder]}>
          <View style={{ flex: 1 }}>
            <T size="sm" weight="semibold">
              Also email me about comments
            </T>
            <T size="xs" color={fg(0.6)} style={{ marginTop: 2 }}>
              Get an email every time someone comments or replies.
            </T>
          </View>
          <Toggle value={emailNotifications} onChange={setEmailNotifications} />
        </View>
      </SettingsSection>

      <SettingsSection title="Announcement screen" summary={bannerSummary} isOpen={openKey === 'banner'} onToggle={() => toggle('banner')}>
        <T size="xs" color={fg(0.6)}>
          Whatever you write here shows as a full branded welcome screen — logo and all — the first time
          someone opens the site. They tap “Continue” to go in. Leave it empty to take it down.
        </T>
        <Input
          value={bannerMessage}
          onChangeText={setBannerMessage}
          multiline
          maxLength={600}
          placeholder="e.g. Emergency meeting tonight at 8pm about the scoreboard. New videos are paused until Sunday — thanks for bearing with us!"
          style={{ marginTop: 12, minHeight: 100 }}
        />
        {bannerMessage.trim() ? (
          <View style={{ marginTop: 12 }}>
            <T size="xs" weight="semibold" color={fg(0.7)} style={{ marginBottom: 4 }}>
              Take it down automatically after:
            </T>
            <View style={styles.wrapRow}>
              {durationOptions.map((opt) => {
                const on = bannerDuration === opt.value;
                return (
                  <Button
                    key={opt.value}
                    label={opt.label}
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 6 },
                      on ? { borderColor: colors.primary, backgroundColor: colors.primary } : { backgroundColor: colors.surface },
                    ]}
                    color={on ? colors.white : undefined}
                    onPress={() => setBannerDuration(opt.value)}
                  />
                );
              })}
            </View>
            {existingExpiry && (
              <T size="xs" color={fg(0.5)} style={{ marginTop: 8 }}>
                Currently set to disappear on {existingExpiry.toLocaleString()}. Pick an option above and
                save to change it.
              </T>
            )}
          </View>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Lock the whole site" summary={lockSummary} isOpen={openKey === 'lock'} onToggle={() => toggle('lock')}>
        <T size="xs" color={fg(0.6)}>
          Closes the entire public site in one switch. You&apos;re never locked out — the admin panel always
          stays open so you can turn it back off.
        </T>
        <View style={{ marginTop: 12, gap: 8 }}>
          {lockOptions.map((opt) => {
            const on = siteLockMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSiteLockMode(opt.value);
                }}
                style={[styles.radioCard, on ? styles.radioCardOn : null]}
              >
                <View style={[styles.radio, { borderColor: on ? colors.primary : fg(0.3) }]}>
                  {on && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <T size="sm" weight="semibold">
                    {opt.label}
                  </T>
                  <T size="xs" color={fg(0.6)}>
                    {opt.hint}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
        {siteLockMode === 'code' && (
          <View style={{ marginTop: 12, gap: 12 }}>
            <Field label="Passcode 1">
              <Input
                value={siteLockPasscode}
                onChangeText={setSiteLockPasscode}
                placeholder="e.g. a code for your friends"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <Field
              label="Passcode 2 (optional)"
              note="Either passcode lets someone in — hand out different ones to different people."
            >
              <Input
                value={siteLockPasscode2}
                onChangeText={setSiteLockPasscode2}
                placeholder="e.g. a different code for someone special"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <Field label="Hint (optional)" note="Shown on the lock screen to help close friends remember the passcode.">
              <Input
                value={siteLockHint}
                onChangeText={setSiteLockHint}
                placeholder="e.g. My favorite color / July's nickname"
              />
            </Field>
          </View>
        )}
      </SettingsSection>

      <SettingsSection
        title="Members-only (approve accounts)"
        summary={requireApproval ? 'On · accounts need your approval' : 'Off · anyone can view'}
        isOpen={openKey === 'members'}
        onToggle={() => toggle('members')}
      >
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <T size="sm" weight="semibold">
              Require an approved account
            </T>
            <T size="xs" color={fg(0.6)} style={{ marginTop: 2 }}>
              When on, the whole site needs a logged-in account that YOU&apos;ve approved. New signups wait in
              the Accounts tab until you approve them. Everyone already signed in stays in.
            </T>
          </View>
          <Toggle value={requireApproval} onChange={setRequireApproval} />
        </View>
        <T size="xs11" color={fg(0.5)} style={{ marginTop: 12 }}>
          Manage who&apos;s in from the{' '}
          <T size="xs11" weight="semibold" color={fg(0.5)}>
            Accounts
          </T>{' '}
          tab — approve, suspend, or remove people there.
        </T>
      </SettingsSection>

      <SettingsSection title="Video passcodes · advanced" summary={passSummary} isOpen={openKey === 'pass'} onToggle={() => toggle('pass')}>
        <T size="xs" color={fg(0.6)}>
          The codes that unlock your hidden videos. For safety the current codes are never shown — set a new
          one to change it. Anyone using an old code will need the new one.
        </T>
        <View style={{ marginTop: 16, gap: 12 }}>
          <PasscodeField
            label="Locked passcode"
            description="Opens the regular Locked section."
            isSet={lockedIsSet}
            mode={lockedMode}
            value={lockedValue}
            onMode={setLockedMode}
            onValue={setLockedValue}
          />
          <PasscodeField
            label="Vault passcode"
            description="The second, deeper code — for videos inside the Vault."
            isSet={vaultIsSet}
            mode={vaultMode}
            value={vaultValue}
            onMode={setVaultMode}
            onValue={setVaultValue}
          />
          <PasscodeField
            label="Security passcode"
            description="Guards this section on the website. Anyone with admin access can upload, but only someone who knows this can see or change the codes above there. The app doesn't ask for it."
            isSet={settingsIsSet}
            mode={settingsMode}
            value={settingsValue}
            onMode={setSettingsMode}
            onValue={setSettingsValue}
          />
        </View>
      </SettingsSection>

      <View style={[styles.wrapRow, { marginTop: 12, gap: 12 }]}>
        <Button
          variant="primary"
          size="sm"
          style={{ paddingHorizontal: 24 }}
          label={saving ? 'Saving...' : 'Save all settings'}
          disabled={saving}
          onPress={handleSave}
        />
        {error ? (
          <T size="xs" color={colors.primary}>
            {error}
          </T>
        ) : null}
        {saved && (
          <T size="xs" weight="semibold" color={tw.emerald600}>
            Saved ✓
          </T>
        )}
      </View>

      <Pressable
        style={{ marginTop: 40, alignSelf: 'flex-start' }}
        hitSlop={8}
        onPress={async () => {
          await logout();
          router.replace('/login');
        }}
      >
        <T size="sm" weight="semibold" color={fg(0.5)}>
          Log out of the app
        </T>
      </Pressable>
    </View>
  );
}

function SettingsSection({
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onToggle();
        }}
        style={({ pressed }) => [styles.sectionHead, pressed && { backgroundColor: fg(0.02) }]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size="sm" weight="semibold">
            {title}
          </T>
          <T size="xs" color={fg(0.5)} numberOfLines={1} style={{ marginTop: 2 }}>
            {summary}
          </T>
        </View>
        <Svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke={fg(0.4)}
          strokeWidth={2.5}
          style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
        >
          <Path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      {isOpen && <View style={styles.sectionBody}>{children}</View>}
    </Card>
  );
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
  onMode: (mode: PassMode) => void;
  onValue: (value: string) => void;
}) {
  return (
    <View style={styles.passBox}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size="sm" weight="semibold">
            {label}
          </T>
          <T size="xs" color={fg(0.5)} style={{ marginTop: 2 }}>
            {description}
          </T>
        </View>
        {mode === 'keep' && (
          <Pill
            label={isSet ? 'Set' : 'Not set'}
            bg={isSet ? tw.emerald100 : fg(0.1)}
            color={isSet ? tw.emerald700 : fg(0.5)}
          />
        )}
      </View>

      {mode === 'keep' ? (
        <View style={[styles.wrapRow, { marginTop: 8 }]}>
          <Button
            label={isSet ? 'Change' : 'Set a passcode'}
            style={{ paddingHorizontal: 12, paddingVertical: 4 }}
            onPress={() => onMode('change')}
          />
          {isSet && (
            <Button
              label="Remove"
              style={{ paddingHorizontal: 12, paddingVertical: 4 }}
              color={colors.primary}
              onPress={() => onMode('remove')}
            />
          )}
        </View>
      ) : mode === 'change' ? (
        <View style={{ marginTop: 8 }}>
          <View style={[styles.wrapRow, { flexWrap: 'nowrap' }]}>
            <Input
              value={value}
              onChangeText={onValue}
              placeholder={`New ${label.toLowerCase()}`}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, backgroundColor: colors.surface }}
            />
            <Pressable
              onPress={() => {
                onMode('keep');
                onValue('');
              }}
            >
              <T size="xs" weight="semibold" color={fg(0.5)}>
                Cancel
              </T>
            </Pressable>
          </View>
          <T size="xs11" color={fg(0.5)} style={{ marginTop: 4 }}>
            Takes effect when you press Save below.
          </T>
        </View>
      ) : (
        <View style={[styles.wrapRow, { marginTop: 8 }]}>
          <T size="xs" weight="semibold" color={colors.primary}>
            Will be removed when you Save.
          </T>
          <Pressable onPress={() => onMode('keep')}>
            <T size="xs" weight="semibold" color={fg(0.6)}>
              Undo
            </T>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <View>
      <T size="xs" weight="semibold" color={fg(0.7)} style={{ marginBottom: 4 }}>
        {label}
      </T>
      {children}
      {note && (
        <T size="xs11" color={fg(0.5)} style={{ marginTop: 4 }}>
          {note}
        </T>
      )}
    </View>
  );
}

// The website's pill switch: h-7 w-12, primary when on.
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onChange(!value);
      }}
      style={[styles.toggle, { backgroundColor: value ? colors.primary : fg(0.2) }]}
    >
      <View style={[styles.knob, { transform: [{ translateX: value ? 20 : 0 }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topBorder: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  radioCardOn: { borderColor: colors.primary, backgroundColor: primaryA(0.05) },
  radio: {
    marginTop: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  passBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  toggle: { width: 48, height: 28, borderRadius: 999, padding: 4 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
});
