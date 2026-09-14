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

type Account = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  selfieUrl: string | null;
  isAdmin: boolean;
  approvalStatus: string;
  createdAt: string;
};

export function AccountsScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<{ users: Account[] }>(
    '/api/admin/users'
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function setApproval(u: Account, status: 'approved' | 'denied') {
    setBusy(u.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await adminFetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approval_status: status }),
      });
      if (!res.ok) Alert.alert('Could not update', 'Try again.');
      else refresh();
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete(u: Account) {
    Alert.alert('Delete account', `Delete ${u.displayName}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(u.id);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            const res = await adminFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
            if (!res.ok) Alert.alert('Could not delete', 'Try again.');
            else refresh();
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <AsyncList
      title="Accounts"
      items={data?.users}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      keyExtractor={(u) => u.id}
      emptyText="No accounts yet."
      renderItem={(u) => (
        <View style={styles.card}>
          <View style={styles.row}>
            {u.avatarUrl ? (
              <Image source={{ uri: u.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{u.displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{u.displayName}</Text>
                {u.isAdmin && <Badge text="Admin" bg="#fde2e6" fg={colors.primary} />}
                {u.approvalStatus === 'pending' && <Badge text="Pending" bg="#fef3c7" fg="#b45309" />}
                {u.approvalStatus === 'denied' && <Badge text="Denied" bg="#fde2e6" fg={colors.primary} />}
              </View>
              <Text style={styles.email} numberOfLines={1}>
                {u.email}
              </Text>
              <Text style={styles.joined}>Joined {relativeTime(u.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            {u.approvalStatus !== 'approved' ? (
              <Pressable
                onPress={() => setApproval(u, 'approved')}
                disabled={busy === u.id}
                style={({ pressed }) => [styles.btn, styles.approveBtn, pressed && styles.pressed]}
              >
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
            ) : !u.isAdmin ? (
              <Pressable
                onPress={() => setApproval(u, 'denied')}
                disabled={busy === u.id}
                style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>Suspend</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => confirmDelete(u)}
              disabled={busy === u.id}
              style={({ pressed }) => [styles.btn, styles.deleteBtn, pressed && styles.pressed]}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.white, fontSize: 18, fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  email: { fontSize: 12, color: colors.muted },
  joined: { fontSize: 11, color: colors.muted },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  approveBtn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  approveText: { fontSize: 13, fontWeight: '700', color: colors.white },
  deleteBtn: { borderColor: colors.primary },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.7 },
});
