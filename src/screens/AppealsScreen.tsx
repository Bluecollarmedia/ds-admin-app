import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Page } from '@/components/Page';
import { Button, Display, ErrorText, Loading, T } from '@/components/ui';
import { adminFetch } from '@/lib/api';
import { relativeTime } from '@/lib/time';
import { useAdminData } from '@/lib/useAdminData';
import { colors, fg, fonts, primaryA, tw } from '@/lib/theme';

type Appeal = {
  id: string;
  name: string;
  contact: string;
  message: string;
  selfieUrl: string | null;
  faceVerified: boolean;
  ip: string;
  geo?: { city?: string; region?: string; country?: string; flag?: string };
  createdAt: string;
  status: 'new' | 'handled';
};

// The website's /admin/appeals page (AppealsList).
export function AppealsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ appeals: Appeal[] }>('/api/admin/appeals');
  const [busy, setBusy] = useState(false);
  const appeals = data?.appeals ?? [];

  async function onAction(action: string, id: string): Promise<string | null> {
    setBusy(true);
    const res = await adminFetch('/api/admin/appeals', {
      method: 'POST',
      body: JSON.stringify({ action, id }),
    }).catch(() => null);
    setBusy(false);
    const d = res ? await res.json().catch(() => null) : null;
    if (action === 'pin') return d?.pin ?? null;
    refresh();
    return null;
  }

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Display>Admin · Appeals</Display>
      <T size="sm" color={fg(0.6)} style={{ marginTop: 8 }}>
        People who were banned and think it&apos;s a mistake. Unban them in one tap, or generate a one-time
        code to send them so they can let themselves back in.
      </T>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} onRetry={refresh} />
      ) : appeals.length === 0 ? (
        <T size="base" color={fg(0.6)} style={{ marginTop: 32, textAlign: 'center' }}>
          No appeals yet.
        </T>
      ) : (
        <View style={{ marginTop: 32, gap: 16 }}>
          {appeals.map((a) => (
            <AppealCard key={a.id} appeal={a} onAction={onAction} busy={busy} />
          ))}
        </View>
      )}
    </Page>
  );
}

function AppealCard({
  appeal,
  onAction,
  busy,
}: {
  appeal: Appeal;
  onAction: (action: string, id: string) => Promise<string | null>;
  busy: boolean;
}) {
  const [pin, setPin] = useState<string | null>(null);
  const place = appeal.geo ? [appeal.geo.city, appeal.geo.region, appeal.geo.country].filter(Boolean).join(', ') : '';

  return (
    <View style={[styles.card, { borderColor: appeal.status === 'new' ? primaryA(0.4) : colors.border }]}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {appeal.selfieUrl ? (
          <Image source={{ uri: appeal.selfieUrl }} style={styles.selfie} contentFit="cover" />
        ) : (
          <View style={[styles.selfie, styles.noPhoto]}>
            <T size="xs" color={fg(0.4)}>
              no photo
            </T>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <T size="base" weight="semibold">
              {appeal.name || 'Someone'}
            </T>
            {appeal.status === 'new' && <Tag label="New" bg={primaryA(0.1)} color={colors.primary} />}
            <Tag
              label={appeal.faceVerified ? 'Face ✓' : 'Face not verified'}
              bg={appeal.faceVerified ? tw.emerald100 : fg(0.1)}
              color={appeal.faceVerified ? tw.emerald700 : fg(0.5)}
            />
          </View>
          <T size="xs" color={fg(0.6)} style={{ marginTop: 2 }}>
            {relativeTime(appeal.createdAt)} ago
            {appeal.contact ? ` · ${appeal.contact}` : ''}
          </T>
          {appeal.message ? (
            <T size="sm" color={fg(0.8)} style={{ marginTop: 8 }}>
              {appeal.message}
            </T>
          ) : null}
          {place || appeal.ip ? (
            <T size="xs" color={fg(0.4)} style={{ marginTop: 4 }}>
              {appeal.geo?.flag ? `${appeal.geo.flag} ` : '📍 '}
              {place || 'unknown'} · {appeal.ip}
            </T>
          ) : null}
        </View>
      </View>

      {pin && (
        <View style={styles.pinBox}>
          <T size="xs" color={fg(0.6)}>
            One-time unban code (give this to them):
          </T>
          <T size="2xl" weight="bold" selectable style={{ marginTop: 4, fontFamily: fonts.mono, letterSpacing: 2.4 }}>
            {pin}
          </T>
          <T size="xs11" color={fg(0.4)} style={{ marginTop: 4 }}>
            Good for 24 hours, works once.
          </T>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          label="Unban"
          style={{ backgroundColor: tw.emerald600, paddingVertical: 6 }}
          color={colors.white}
          disabled={busy}
          onPress={() => onAction('unban', appeal.id)}
        />
        <Button
          label="Generate unban code"
          style={{ paddingVertical: 6 }}
          disabled={busy}
          onPress={async () => {
            const p = await onAction('pin', appeal.id);
            if (p) setPin(p);
          }}
        />
        {appeal.status === 'new' && (
          <Button
            label="Mark handled"
            style={{ paddingVertical: 6 }}
            color={fg(0.6)}
            disabled={busy}
            onPress={() => onAction('handled', appeal.id)}
          />
        )}
        <Button
          label="Delete"
          style={{ paddingVertical: 6 }}
          color={colors.primary}
          disabled={busy}
          onPress={() =>
            Alert.alert('Delete this appeal?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onAction('delete', appeal.id) },
            ])
          }
        />
      </View>
    </View>
  );
}

function Tag({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2 }}>
      <T size="xs10" weight="semibold" color={color}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  selfie: { width: 96, height: 96, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  noPhoto: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  pinBox: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
});
