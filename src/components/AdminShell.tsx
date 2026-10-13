import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Display, T } from '@/components/ui';
import { adminJson } from '@/lib/api';
import { colors, fg, WEBSITE_URL } from '@/lib/theme';

type Counts = { unreadNotifications: number; newAppeals: number; pendingAccounts: number };

// The website admin's top bar (AdminNav): "D&S Admin" + "Back to Main Site",
// then a sideways-scrolling row of tabs with a red underline on the active one.
// In the app every tab is available (no second passcode).
export function AdminShell() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState<Counts | null>(null);

  // Badge counts refresh whenever you change tabs (the web layout re-reads them
  // on every page load).
  useEffect(() => {
    adminJson<Counts>('/api/admin/nav-counts')
      .then(setCounts)
      .catch(() => {});
  }, [pathname]);

  const links = [
    { href: '/reviews', label: 'Reviews' },
    { href: '/settings', label: 'Settings' },
    { href: '/visitors', label: 'Visitors' },
    { href: '/appeals', label: `Appeals${counts?.newAppeals ? ` (${counts.newAppeals})` : ''}` },
    { href: '/accounts', label: `Accounts${counts?.pendingAccounts ? ` (${counts.pendingAccounts})` : ''}` },
    { href: '/comments', label: 'Comments' },
    {
      href: '/notifications',
      label: `Notifications${counts?.unreadNotifications ? ` (${counts.unreadNotifications})` : ''}`,
    },
    { href: '/push', label: 'Push' },
    { href: '/storage', label: 'Storage' },
  ] as const;

  // Keep the active tab in view, like the browser does when you land on it.
  const scrollRef = useRef<ScrollView>(null);
  const tabX = useRef<Record<string, { x: number; width: number }>>({});
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const pos = tabX.current[pathname];
    if (!pos || !barWidth) return;
    const target = Math.max(0, pos.x + pos.width / 2 - barWidth / 2);
    scrollRef.current?.scrollTo({ x: target, animated: true });
  }, [pathname, barWidth]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.topRow}>
        <Display size="lg">D&amp;S Admin</Display>
        <Pressable onPress={() => Linking.openURL(WEBSITE_URL)} hitSlop={8}>
          <T size="sm" weight="semibold" color={fg(0.6)}>
            ← Back to Main Site
          </T>
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nav}
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Pressable
              key={link.href}
              onLayout={(e) => {
                tabX.current[link.href] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
              }}
              onPress={() => {
                if (active) return;
                Haptics.selectionAsync();
                router.replace(link.href);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <T size="sm" weight="semibold" color={active ? colors.primary : fg(0.6)}>
                {link.label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  nav: { paddingHorizontal: 20, gap: 4 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
});
