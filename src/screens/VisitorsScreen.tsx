import { useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, Display, ErrorText, Input, Loading, T } from '@/components/ui';
import { adminFetch, adminJson } from '@/lib/api';
import { relativeTime } from '@/lib/time';
import { useAdminData } from '@/lib/useAdminData';
import { colors, fg, fonts, primaryA } from '@/lib/theme';

type VisitorGeo = {
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
  org?: string;
  lat?: number;
  lon?: number;
  flag?: string;
};
type VisitorLocation = { ip: string; geo?: VisitorGeo; count: number; lastSeen: string };
type Visitor = {
  id: string;
  label?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  locations: VisitorLocation[];
  hitCount: number;
  loginOnly: boolean;
};
type VisitorsData = { visitors: Visitor[]; hidden: string[]; bannedIps: string[]; banMessage: string };
type Hit = { p: string; t: string };
type VideoMeta = Record<string, { title: string; status: string }>;
type ActionOpts = { id?: string; ips?: string[]; label?: string };

function fullTime(iso: string) {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

function prettySlug(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Turn a raw URL path into a plain-English "what they did" line (same as the web).
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
    return { icon: '💬', label: `Comments on “${t}”` };
  }
  const video = clean.match(/^\/videos\/([^/]+)$/);
  if (video) {
    const meta = videos[video[1]];
    const t = meta?.title || prettySlug(video[1]);
    if (meta?.status === 'vault') return { icon: '🗝️', label: `Watched Vault video “${t}”` };
    if (meta?.status === 'locked') return { icon: '🔒', label: `Watched Locked video “${t}”` };
    return { icon: '🎬', label: `Watched “${t}”` };
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

type Row =
  | { kind: 'visitor'; visitor: Visitor; hidden: boolean }
  | { kind: 'toggle'; which: 'login' | 'hidden'; count: number; open: boolean };

// The website's /admin/visitors page (AdminVisitors).
export function VisitorsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<VisitorsData>('/api/admin/visitors');
  const [busy, setBusy] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showLoginOnly, setShowLoginOnly] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    await adminFetch('/api/admin/visitors', { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
    setBusy(false);
    refresh();
  }
  const onAction = (action: string, opts: ActionOpts) => post({ action, ...opts });

  function clearAll() {
    Alert.alert('Clear the entire visitor log?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => post({ action: 'clear-all' }) },
    ]);
  }

  const visitors = data?.visitors ?? [];
  const hiddenSet = new Set(data?.hidden ?? []);
  const bannedSet = new Set(data?.bannedIps ?? []);
  const isBanned = (v: Visitor) => bannedSet.has(v.id) || (v.locations ?? []).some((l) => bannedSet.has(l.ip));
  const notHidden = visitors.filter((v) => !hiddenSet.has(v.id));
  const hiddenVisitors = visitors.filter((v) => hiddenSet.has(v.id));
  const loginOnlyVisitors = notHidden.filter((v) => v.loginOnly);
  const visible = notHidden
    .filter((v) => !v.loginOnly)
    .sort((a, b) => {
      const an = a.label ? 0 : 1;
      const bn = b.label ? 0 : 1;
      if (an !== bn) return an - bn;
      return b.lastSeen.localeCompare(a.lastSeen);
    });

  const rows: Row[] = [
    ...visible.map((v): Row => ({ kind: 'visitor', visitor: v, hidden: false })),
    ...(loginOnlyVisitors.length
      ? [
          { kind: 'toggle', which: 'login', count: loginOnlyVisitors.length, open: showLoginOnly } as Row,
          ...(showLoginOnly
            ? loginOnlyVisitors.map((v): Row => ({ kind: 'visitor', visitor: v, hidden: false }))
            : []),
        ]
      : []),
    ...(hiddenVisitors.length
      ? [
          { kind: 'toggle', which: 'hidden', count: hiddenVisitors.length, open: showHidden } as Row,
          ...(showHidden ? hiddenVisitors.map((v): Row => ({ kind: 'visitor', visitor: v, hidden: true })) : []),
        ]
      : []),
  ];

  const header = (
    <View>
      <Display>Admin · Visitors</Display>
      <T size="sm" color={fg(0.6)} style={{ marginTop: 8 }}>
        Grouped by device, so one phone is one visitor even when its IP keeps changing. Name a device so
        you know who it is, or hide one (like your own).
      </T>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} onRetry={refresh} />
      ) : (
        <View style={{ marginTop: 32, gap: 16, marginBottom: 16 }}>
          <BanMessageBox initial={data?.banMessage ?? ''} busy={busy} onSave={(m) => post({ action: 'ban-message', message: m })} />
          {visitors.length > 0 && (
            <View style={styles.between}>
              <T size="xs" color={fg(0.5)}>
                {visitors.length} {visitors.length === 1 ? 'device' : 'devices'} logged
              </T>
              <Pressable onPress={clearAll} disabled={busy} hitSlop={8}>
                <T size="xs" weight="semibold" color={colors.primary}>
                  Clear all history
                </T>
              </Pressable>
            </View>
          )}
          {notHidden.length === 0 && (
            <T size="base" color={fg(0.6)} style={{ textAlign: 'center' }}>
              No visitors logged yet. As people browse the site, their devices show up here.
            </T>
          )}
          {visible.length === 0 && loginOnlyVisitors.length > 0 && (
            <T size="sm" color={fg(0.5)} style={{ textAlign: 'center' }}>
              Only login-page visitors so far — see them in the dropdown below.
            </T>
          )}
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 60 }}
      data={loading || error ? [] : rows}
      keyExtractor={(r) => (r.kind === 'visitor' ? r.visitor.id : `toggle-${r.which}`)}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      renderItem={({ item }) =>
        item.kind === 'visitor' ? (
          <VisitorRow
            visitor={item.visitor}
            hidden={item.hidden}
            banned={isBanned(item.visitor)}
            onAction={onAction}
            busy={busy}
          />
        ) : (
          <Pressable
            style={{ marginTop: item.which === 'hidden' ? 16 : 8 }}
            onPress={() => (item.which === 'login' ? setShowLoginOnly((v) => !v) : setShowHidden((v) => !v))}
          >
            <T size="sm" weight="semibold" color={fg(0.6)}>
              {item.which === 'login'
                ? `${item.open ? 'Hide' : 'Show'} login-only visitors (${item.count}) — mostly bots & tests`
                : `${item.open ? 'Hide' : 'Show'} hidden devices (${item.count})`}
            </T>
          </Pressable>
        )
      }
    />
  );
}

function BanMessageBox({ initial, busy, onSave }: { initial: string; busy: boolean; onSave: (m: string) => void }) {
  const [message, setMessage] = useState(initial);
  const unchanged = message === initial;
  return (
    <Card style={{ padding: 16 }}>
      <T size="sm" weight="semibold">
        Message shown to banned visitors
      </T>
      <T size="xs" color={fg(0.5)} style={{ marginTop: 2 }}>
        Anyone you ban (by IP) is blocked from the whole site and sees this on a branded page.
      </T>
      <Input
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder="e.g. You've been blocked from D&S Food Reviews."
        style={{ marginTop: 8, minHeight: 76 }}
      />
      <Button
        variant="primary"
        label="Save message"
        style={{ marginTop: 8, alignSelf: 'flex-start', paddingVertical: 6 }}
        disabled={busy || unchanged}
        onPress={() => onSave(message)}
      />
    </Card>
  );
}

function placeLabel(loc: VisitorLocation | undefined): string {
  if (!loc?.geo) return loc?.ip || 'unknown';
  const { geo } = loc;
  const place = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');
  return `${geo.flag ? geo.flag + ' ' : ''}${place || loc.ip}`;
}

function LocationLine({ loc }: { loc: VisitorLocation }) {
  const provider = loc.geo?.isp || loc.geo?.org;
  const hasCoords = typeof loc.geo?.lat === 'number' && typeof loc.geo?.lon === 'number';
  return (
    <View>
      <T size="xs" weight="medium" color={fg(0.8)}>
        {placeLabel(loc)}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 }}>
        <T size="xs" color={fg(0.5)} style={{ fontFamily: fonts.mono }}>
          {loc.ip}
        </T>
        {provider ? (
          <T size="xs" color={fg(0.5)}>
            · {provider}
          </T>
        ) : null}
        {hasCoords && (
          <>
            <T size="xs" color={fg(0.5)}>
              ·
            </T>
            <Pressable
              hitSlop={6}
              onPress={() => Linking.openURL(`https://www.google.com/maps?q=${loc.geo!.lat},${loc.geo!.lon}`)}
            >
              <T size="xs" weight="semibold" color={colors.primary}>
                map
              </T>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function VisitorRow({
  visitor,
  hidden,
  banned,
  onAction,
  busy,
}: {
  visitor: Visitor;
  hidden: boolean;
  banned: boolean;
  onAction: (action: string, opts: ActionOpts) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(visitor.label ?? '');
  const [shownVisits, setShownVisits] = useState(3);
  const [details, setDetails] = useState<{ hits: Hit[]; videos: VideoMeta } | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const locations = visitor.locations ?? [];
  const primary = locations[0];
  const visits = details ? groupVisits(details.hits) : [];

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && !details) {
      setDetailsError(null);
      try {
        setDetails(await adminJson(`/api/admin/visitors?id=${encodeURIComponent(visitor.id)}`));
      } catch (e) {
        setDetailsError(e instanceof Error ? e.message : "Couldn't load visits.");
      }
    }
  }

  function confirmBan() {
    Alert.alert(
      'Ban this device?',
      "They'll see your ban message on every page. (They could still get back in by clearing their browser data or using a different device.)",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Ban', style: 'destructive', onPress: () => onAction('ban', { id: visitor.id, ips: locations.map((l) => l.ip) }) },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert("Delete this device's history?", undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onAction('clear', { id: visitor.id }) },
    ]);
  }

  return (
    <View style={[styles.row, hidden && styles.rowHidden]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <T size="sm" weight="semibold">
          {visitor.label || 'Visitor'}
        </T>
        {banned && (
          <View style={styles.tag}>
            <T size="xs10" weight="semibold" color={colors.primary}>
              Banned
            </T>
          </View>
        )}
      </View>
      <T size="xs" color={fg(0.6)} style={{ marginTop: 4 }}>
        Last seen {relativeTime(visitor.lastSeen)} ago · {visitor.count} {visitor.count === 1 ? 'visit' : 'visits'}
      </T>
      {primary && (
        <View style={{ marginTop: 6 }}>
          <LocationLine loc={primary} />
          {locations.length > 1 && (
            <T size="xs11" color={fg(0.4)} style={{ marginTop: 2 }}>
              Seen from {locations.length} different IPs/places (cellular usually means one phone hopping IPs).
            </T>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <ActionLink label={visitor.label ? 'Rename' : 'Name it'} onPress={() => setEditingLabel((v) => !v)} />
        {hidden ? (
          <ActionLink label="Unhide" disabled={busy} onPress={() => onAction('unhide', { id: visitor.id })} />
        ) : (
          <ActionLink label="Hide" disabled={busy} onPress={() => onAction('hide', { id: visitor.id })} />
        )}
        {banned ? (
          <ActionLink
            label="Unban"
            disabled={busy}
            onPress={() => onAction('unban', { id: visitor.id, ips: locations.map((l) => l.ip) })}
          />
        ) : (
          <ActionLink label="Ban" color={colors.primary} disabled={busy} onPress={confirmBan} />
        )}
        <ActionLink label="Delete" disabled={busy} onPress={confirmDelete} />
      </View>

      {editingLabel && (
        <View style={[styles.actions, { marginTop: 12 }]}>
          <Input
            value={labelInput}
            onChangeText={setLabelInput}
            placeholder="e.g. Me, Shmuel, Mom..."
            style={{ width: 192, paddingVertical: 6 }}
          />
          <Button
            variant="primary"
            label="Save"
            style={{ paddingVertical: 6 }}
            disabled={busy}
            onPress={() => {
              onAction('label', { id: visitor.id, label: labelInput });
              setEditingLabel(false);
            }}
          />
          <Pressable
            onPress={() => {
              setLabelInput(visitor.label ?? '');
              setEditingLabel(false);
            }}
          >
            <T size="xs" weight="semibold" color={fg(0.5)}>
              Cancel
            </T>
          </Pressable>
        </View>
      )}

      <Pressable onPress={toggleExpanded} style={{ marginTop: 12, alignSelf: 'flex-start' }} hitSlop={6}>
        <T size="xs" weight="semibold" color={colors.primary}>
          {expanded ? 'Hide details' : 'Show visits & IPs'}
        </T>
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          {locations.length > 1 && (
            <View>
              <T size="xs11" weight="semibold" color={fg(0.4)} style={styles.caps}>
                IPs / places used
              </T>
              <View style={{ gap: 6 }}>
                {locations.map((loc) => (
                  <LocationLine key={loc.ip} loc={loc} />
                ))}
              </View>
            </View>
          )}
          <View>
            {detailsError ? (
              <T size="xs" color={colors.primary}>
                {detailsError}
              </T>
            ) : !details ? (
              <Loading />
            ) : (
              <>
                <T size="xs11" weight="semibold" color={fg(0.4)} style={[styles.caps, { marginBottom: 6 }]}>
                  Visits ({visits.length}) — tap one to see what they did
                </T>
                <View style={{ gap: 8 }}>
                  {visits.slice(0, shownVisits).map((visit, i) => (
                    <VisitItem key={visit.end + i} visit={visit} videos={details.videos} defaultOpen={i === 0} />
                  ))}
                </View>
                {visits.length > shownVisits && (
                  <Pressable onPress={() => setShownVisits((n) => n + 3)} style={{ marginTop: 8 }}>
                    <T size="xs" weight="semibold" color={colors.primary}>
                      Show more visits ({visits.length - shownVisits} older)
                    </T>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function VisitItem({ visit, videos, defaultOpen }: { visit: Visit; videos: VideoMeta; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.visit}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.visitHead}>
        <T size="xs" weight="semibold" color={fg(0.8)}>
          {fullTime(visit.end)}
        </T>
        <T size="xs11" color={fg(0.4)}>
          {visit.hits.length} {visit.hits.length === 1 ? 'action' : 'actions'} {open ? '▴' : '▾'}
        </T>
      </Pressable>
      {open && (
        <View style={styles.visitBody}>
          {visit.hits.map((hit, i) => {
            const d = describePath(hit.p, videos);
            return (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <T size="xs" color={fg(0.8)} style={{ flex: 1 }}>
                  {d.icon} {d.label}
                </T>
                <T size="xs" color={fg(0.4)}>
                  {fullTime(hit.t)}
                </T>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ActionLink({
  label,
  onPress,
  disabled,
  color = fg(0.6),
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={disabled ? { opacity: 0.5 } : undefined}>
      <T size="xs" weight="semibold" color={color}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  rowHidden: { borderStyle: 'dashed', opacity: 0.6 },
  tag: { borderRadius: 999, backgroundColor: primaryA(0.1), paddingHorizontal: 8, paddingVertical: 2 },
  actions: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  details: { marginTop: 8, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  caps: { textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  visit: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(251,246,239,0.6)', overflow: 'hidden' },
  visitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  visitBody: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 },
});
