import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { AsyncList } from '@/components/AsyncList';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { relativeTime } from '@/lib/time';
import { colors } from '@/lib/theme';

type Geo = { city?: string; region?: string; country?: string; flag?: string; isp?: string; org?: string; lat?: number; lon?: number };
type Location = { ip: string; geo?: Geo; count: number };
type Hit = { t: string; p: string; ip: string };
type Visitor = { id: string; label?: string; count: number; lastSeen: string; hits?: Hit[]; locations?: Location[] };
type VideoMeta = Record<string, { title: string; status: string }>;
type VisitorsData = { visitors: Visitor[]; hidden: string[]; bannedIps: string[]; banMessage: string; videos: VideoMeta };

function placeLabel(loc?: Location): string {
  if (!loc) return '';
  if (!loc.geo) return loc.ip;
  const place = [loc.geo.city, loc.geo.region, loc.geo.country].filter(Boolean).join(', ');
  return `${loc.geo.flag ? loc.geo.flag + ' ' : ''}${place || loc.ip}`;
}

function fullTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function prettySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Auth/login-type pages. A visitor who only ever hit these (and has no name) is
// almost always a bot or a quick test — tucked into a dropdown, same as web.
const LOGIN_PATHS = new Set([
  '/login',
  '/signup',
  '/admin/login',
  '/locked/login',
  '/locked/vault/login',
  '/site-locked',
  '/reset-password',
  '/pending',
]);
function isLoginOnly(v: Visitor): boolean {
  if (v.label) return false;
  const hits = v.hits ?? [];
  if (hits.length === 0) return true;
  return hits.every((h) => {
    const clean = h.p.split('?')[0].replace(/\/+$/, '') || '/';
    return LOGIN_PATHS.has(clean);
  });
}

function describePath(path: string, videos: VideoMeta): { icon: string; label: string } {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  const simple: Record<string, { icon: string; label: string }> = {
    '/': { icon: '🏠', label: 'Home page' },
    '/reviews': { icon: '📋', label: 'Browsed all reviews' },
    '/shorts': { icon: '▶️', label: 'Shorts feed' },
    '/about': { icon: 'ℹ️', label: 'About page' },
    '/history': { icon: '🕘', label: 'Watch history' },
    '/locked': { icon: '🔒', label: 'Opened the Locked list' },
    '/locked/login': { icon: '🔒', label: 'Locked login' },
    '/locked/vault': { icon: '🗝️', label: 'Opened the Vault list' },
    '/locked/vault/login': { icon: '🗝️', label: 'Vault login' },
    '/notifications': { icon: '🔔', label: 'Notifications' },
    '/settings': { icon: '⚙️', label: 'Account settings' },
    '/login': { icon: '👤', label: 'Log in page' },
    '/signup': { icon: '👤', label: 'Sign up page' },
  };
  if (simple[clean]) return simple[clean];
  const comments = clean.match(/^\/videos\/([^/]+)\/comments$/);
  if (comments) {
    const t = videos[comments[1]]?.title || prettySlug(comments[1]);
    return { icon: '💬', label: `Comments on "${t}"` };
  }
  const video = clean.match(/^\/videos\/([^/]+)$/);
  if (video) {
    const meta = videos[video[1]];
    const t = meta?.title || prettySlug(video[1]);
    if (meta?.status === 'vault') return { icon: '🗝️', label: `Watched Vault video "${t}"` };
    if (meta?.status === 'locked') return { icon: '🔒', label: `Watched Locked video "${t}"` };
    return { icon: '🎬', label: `Watched "${t}"` };
  }
  return { icon: '•', label: clean };
}

type Visit = { end: string; start: string; hits: Hit[] };
const VISIT_GAP_MS = 30 * 60 * 1000;
function groupVisits(hits: Hit[]): Visit[] {
  const sorted = [...hits].sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime());
  const visits: Visit[] = [];
  for (const h of sorted) {
    const last = visits[visits.length - 1];
    if (last && new Date(last.start).getTime() - new Date(h.t).getTime() <= VISIT_GAP_MS) {
      last.hits.push(h);
      last.start = h.t;
    } else {
      visits.push({ end: h.t, start: h.t, hits: [h] });
    }
  }
  return visits;
}

export function VisitorsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<VisitorsData>('/api/admin/visitors');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [showLoginOnly, setShowLoginOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const hiddenSet = new Set(data?.hidden ?? []);
  const bannedSet = new Set(data?.bannedIps ?? []);
  const isBanned = (v: Visitor) => bannedSet.has(v.id) || (v.locations ?? []).some((l) => bannedSet.has(l.ip));

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
    const res = await adminFetch('/api/admin/visitors', { method: 'POST', body: JSON.stringify({ action: 'ban-message', message }) });
    if (res.ok) {
      setMessage(null);
      refresh();
    }
  }

  const videos = data?.videos ?? {};
  const notHidden = (data?.visitors ?? []).filter((v) => !hiddenSet.has(v.id));
  const hiddenVisitors = (data?.visitors ?? []).filter((v) => hiddenSet.has(v.id));
  const loginOnly = notHidden.filter(isLoginOnly);
  const visible = notHidden
    .filter((v) => !isLoginOnly(v))
    .sort((a, b) => {
      const aNamed = a.label ? 0 : 1;
      const bNamed = b.label ? 0 : 1;
      if (aNamed !== bNamed) return aNamed - bNamed;
      return b.lastSeen.localeCompare(a.lastSeen);
    });

  function renderCard(v: Visitor, hidden: boolean) {
    return (
      <VisitorCard
        key={v.id}
        visitor={v}
        hidden={hidden}
        banned={isBanned(v)}
        videos={videos}
        busy={busy === v.id}
        editing={editing === v.id}
        labelInput={labelInput}
        onStartEdit={() => {
          setLabelInput(v.label ?? '');
          setEditing(v.id);
        }}
        onChangeLabel={setLabelInput}
        onSaveLabel={() => saveLabel(v)}
        onCancelEdit={() => setEditing(null)}
        onHideToggle={() => action(v, hidden ? 'unhide' : 'hide')}
        onBanToggle={() => toggleBan(v)}
        onDelete={() => action(v, 'clear', "Delete this device's history?")}
      />
    );
  }

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
          <View style={{ gap: 12, marginBottom: 4 }}>
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
          </View>
        ) : undefined
      }
      renderItem={(v) => renderCard(v, false)}
      listFooter={
        <View style={{ gap: 12 }}>
          {loginOnly.length > 0 && (
            <View>
              <Pressable onPress={() => setShowLoginOnly((s) => !s)} hitSlop={6}>
                <Text style={styles.dropdownToggle}>
                  {showLoginOnly ? 'Hide' : 'Show'} login-only visitors ({loginOnly.length}) — mostly bots & tests
                </Text>
              </Pressable>
              {showLoginOnly && <View style={{ gap: 12, marginTop: 10 }}>{loginOnly.map((v) => renderCard(v, false))}</View>}
            </View>
          )}
          {hiddenVisitors.length > 0 && (
            <View>
              <Pressable onPress={() => setShowHidden((s) => !s)} hitSlop={6}>
                <Text style={styles.dropdownToggle}>
                  {showHidden ? 'Hide' : 'Show'} hidden devices ({hiddenVisitors.length})
                </Text>
              </Pressable>
              {showHidden && <View style={{ gap: 12, marginTop: 10 }}>{hiddenVisitors.map((v) => renderCard(v, true))}</View>}
            </View>
          )}
        </View>
      }
    />
  );
}

function VisitorCard({
  visitor: v,
  hidden,
  banned,
  videos,
  busy,
  editing,
  labelInput,
  onStartEdit,
  onChangeLabel,
  onSaveLabel,
  onCancelEdit,
  onHideToggle,
  onBanToggle,
  onDelete,
}: {
  visitor: Visitor;
  hidden: boolean;
  banned: boolean;
  videos: VideoMeta;
  busy: boolean;
  editing: boolean;
  labelInput: string;
  onStartEdit: () => void;
  onChangeLabel: (t: string) => void;
  onSaveLabel: () => void;
  onCancelEdit: () => void;
  onHideToggle: () => void;
  onBanToggle: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [shownVisits, setShownVisits] = useState(3);
  const locations = v.locations ?? [];
  const primary = locations[0];
  const visits = groupVisits(v.hits ?? []);

  return (
    <View style={[styles.card, hidden && styles.cardHidden]}>
      <View style={styles.nameRow}>
        <Text style={styles.name}>{v.label || 'Visitor'}</Text>
        {banned && (
          <View style={styles.bannedBadge}>
            <Text style={styles.bannedText}>Banned</Text>
          </View>
        )}
      </View>
      <Text style={styles.meta}>
        Last seen {relativeTime(v.lastSeen)} ago · {v.count} {v.count === 1 ? 'visit' : 'visits'}
      </Text>
      {primary && <Text style={styles.loc}>{placeLabel(primary)}</Text>}
      {locations.length > 1 && (
        <Text style={styles.locNote}>Seen from {locations.length} IPs/places (cellular usually means one phone hopping IPs).</Text>
      )}

      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            value={labelInput}
            onChangeText={onChangeLabel}
            placeholder="e.g. Me, Shmuel, Mom..."
            placeholderTextColor={colors.muted}
            style={styles.editInput}
            autoFocus
          />
          <Pressable onPress={onSaveLabel} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
          <Pressable onPress={onCancelEdit} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Act label={v.label ? 'Rename' : 'Name it'} onPress={onStartEdit} />
          <Act label={hidden ? 'Unhide' : 'Hide'} onPress={onHideToggle} />
          <Act label={banned ? 'Unban' : 'Ban'} danger={!banned} onPress={onBanToggle} />
          <Act label="Delete" onPress={onDelete} />
        </View>
      )}
      {busy && <Text style={styles.working}>Working…</Text>}

      <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={6}>
        <Text style={styles.expandToggle}>{expanded ? 'Hide details' : 'Show visits & IPs'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          {locations.length > 1 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.detailHeading}>IPs / places used</Text>
              {locations.map((loc) => (
                <View key={loc.ip}>
                  <Text style={styles.ipPlace}>{placeLabel(loc)}</Text>
                  <Text style={styles.ipMeta}>
                    {loc.ip}
                    {loc.geo?.isp || loc.geo?.org ? ` · ${loc.geo.isp || loc.geo.org}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {visits.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.detailHeading}>
                Visits ({visits.length}) — tap one to see what they did
              </Text>
              {visits.slice(0, shownVisits).map((visit, i) => (
                <VisitItem key={visit.end + i} visit={visit} videos={videos} defaultOpen={i === 0} />
              ))}
              {visits.length > shownVisits && (
                <Pressable onPress={() => setShownVisits((n) => n + 3)} hitSlop={6}>
                  <Text style={styles.showMore}>Show more visits ({visits.length - shownVisits} older)</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function VisitItem({ visit, videos, defaultOpen }: { visit: Visit; videos: VideoMeta; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <View style={styles.visitBox}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.visitHeader}>
        <Text style={styles.visitTime}>{fullTime(visit.end)}</Text>
        <Text style={styles.visitCount}>
          {visit.hits.length} {visit.hits.length === 1 ? 'action' : 'actions'} {open ? '▾' : '▸'}
        </Text>
      </Pressable>
      {open && (
        <View style={styles.visitBody}>
          {visit.hits.map((hit, i) => {
            const d = describePath(hit.p, videos);
            return (
              <View key={i} style={styles.visitRow}>
                <Text style={styles.visitLabel} numberOfLines={1}>
                  {d.icon} {d.label}
                </Text>
                <Text style={styles.visitTimeSmall}>{fullTime(hit.t)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
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
  msgBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 8 },
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
  dropdownToggle: { fontSize: 13, fontWeight: '700', color: colors.muted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 4 },
  cardHidden: { borderStyle: 'dashed', opacity: 0.65 },
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
  expandToggle: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 10 },
  detail: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
  detailHeading: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  ipPlace: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  ipMeta: { fontSize: 11, color: colors.muted },
  visitBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surfaceMuted },
  visitTime: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  visitCount: { fontSize: 11, color: colors.muted },
  visitBody: { paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  visitRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  visitLabel: { flex: 1, fontSize: 12, color: colors.foreground },
  visitTimeSmall: { fontSize: 11, color: colors.muted },
  showMore: { fontSize: 12, fontWeight: '700', color: colors.primary },
});
