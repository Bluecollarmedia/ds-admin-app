import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Page } from '@/components/Page';
import { Button, ErrorText, Loading, PageHeading, T } from '@/components/ui';
import { adminFetch } from '@/lib/api';
import { relativeTime } from '@/lib/time';
import { useAdminData } from '@/lib/useAdminData';
import { colors, fg, fonts, primaryA, tw } from '@/lib/theme';

type AdminUserRow = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  selfieUrl: string | null;
  isAdmin: boolean;
  approvalStatus: string;
  commentsRestricted: boolean;
  canUpload: boolean;
  createdAt: string;
};

// The website's /admin/users page (AdminUsersList).
export function AccountsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ users: AdminUserRow[] }>('/api/admin/users');
  const users = data?.users ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function send(id: string, method: string, body?: Record<string, unknown>) {
    setBusyId(id);
    await adminFetch(`/api/admin/users/${id}`, { method, body: body ? JSON.stringify(body) : undefined }).catch(() => {});
    setBusyId(null);
    refresh();
  }

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <PageHeading
        title="All Accounts"
        description={data ? `Every viewer account that has signed up, ${users.length} total.` : undefined}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorText message={error} onRetry={refresh} />
      ) : users.length === 0 ? (
        <T size="base" color={fg(0.6)} style={{ marginTop: 32, textAlign: 'center' }}>
          No accounts yet.
        </T>
      ) : (
        <View style={{ marginTop: 24 }}>
          {users.map((u, i) => {
            const pending = u.approvalStatus === 'pending';
            const denied = u.approvalStatus === 'denied';
            const busy = busyId === u.id;
            return (
              <View key={u.id} style={[styles.row, i > 0 && styles.divider]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {u.avatarUrl ? (
                    <Image source={{ uri: u.avatarUrl }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.initial]}>
                      <T style={{ fontFamily: fonts.display, fontSize: 16 }} color={colors.white}>
                        {u.displayName.charAt(0).toUpperCase()}
                      </T>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <T size="sm" weight="semibold">
                        {u.displayName}
                      </T>
                      {u.isAdmin && <Tag label="ADMIN" bg={primaryA(0.1)} color={colors.primary} />}
                      {pending && <Tag label="Pending" bg={tw.amber100} color={tw.amber700} />}
                      {u.commentsRestricted && <Tag label="Own comments only" bg={fg(0.1)} color={fg(0.7)} />}
                      {denied && <Tag label="Denied" bg={primaryA(0.1)} color={colors.primary} />}
                    </View>
                    <T size="xs" color={fg(0.5)} numberOfLines={1}>
                      {u.email}
                    </T>
                    <T size="xs11" color={fg(0.4)}>
                      Joined {relativeTime(u.createdAt)}
                    </T>
                  </View>
                </View>
                {u.selfieUrl && (
                  <Pressable onPress={() => setLightbox(u.selfieUrl)} style={styles.selfieBtn}>
                    <Image source={{ uri: u.selfieUrl }} style={styles.selfie} contentFit="cover" />
                    <T size="xs11" weight="semibold" color={fg(0.5)}>
                      Verification selfie
                    </T>
                  </Pressable>
                )}

                <View style={styles.actions}>
                  {u.approvalStatus !== 'approved' && (
                    <Button
                      label="Approve"
                      style={[styles.small, { backgroundColor: tw.emerald600 }]}
                      color={colors.white}
                      disabled={busy}
                      onPress={() => send(u.id, 'PATCH', { approval_status: 'approved' })}
                    />
                  )}
                  {u.approvalStatus === 'approved' && !u.isAdmin && (
                    <Button
                      label="Suspend"
                      style={styles.small}
                      disabled={busy}
                      onPress={() => send(u.id, 'PATCH', { approval_status: 'denied' })}
                    />
                  )}
                  {!u.isAdmin && (
                    <Button
                      label={u.commentsRestricted ? 'Show all comments' : 'Restrict comments'}
                      style={styles.small}
                      disabled={busy}
                      onPress={() =>
                        send(u.id, 'PUT', { comments_visibility: u.commentsRestricted ? 'all' : 'own_only' })
                      }
                    />
                  )}
                  {!u.isAdmin && (
                    <Button
                      label={u.canUpload ? '✓ Can upload' : 'Allow uploads'}
                      style={[
                        styles.small,
                        u.canUpload && { borderColor: tw.emerald600, backgroundColor: 'rgba(5,150,105,0.1)' },
                      ]}
                      color={u.canUpload ? tw.emerald700 : undefined}
                      disabled={busy}
                      onPress={() => send(u.id, 'PATCH', { can_upload: !u.canUpload })}
                    />
                  )}
                  {confirmingId === u.id ? (
                    <>
                      <Button
                        variant="primary"
                        label={busy ? 'Deleting...' : 'Confirm'}
                        style={styles.small}
                        disabled={busy}
                        onPress={async () => {
                          await send(u.id, 'DELETE');
                          setConfirmingId(null);
                        }}
                      />
                      <Button label="Cancel" style={styles.small} disabled={busy} onPress={() => setConfirmingId(null)} />
                    </>
                  ) : (
                    <Button
                      variant="outlinePrimary"
                      label="Delete"
                      style={styles.small}
                      onPress={() => setConfirmingId(u.id)}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          {lightbox && <Image source={{ uri: lightbox }} style={styles.lightboxImg} contentFit="contain" />}
        </Pressable>
      </Modal>
    </Page>
  );
}

function Tag({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2 }}>
      <T size="xs10" weight="semibold" color={color} style={label === 'ADMIN' ? { letterSpacing: 0.25 } : undefined}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 16, gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  initial: { backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  selfieBtn: { marginLeft: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selfie: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  small: { paddingHorizontal: 12, paddingVertical: 4 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  lightboxImg: { width: '100%', height: '85%', borderRadius: 12 },
});
