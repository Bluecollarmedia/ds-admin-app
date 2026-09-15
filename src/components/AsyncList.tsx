import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { Header } from './Header';
import { colors } from '@/lib/theme';

type Props<T> = {
  title: string;
  headerRight?: React.ReactNode;
  items: T[] | undefined;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
  emptyText?: string;
  listHeader?: React.ReactElement;
  listFooter?: React.ReactElement;
};

export function AsyncList<T>({
  title,
  headerRight,
  items,
  loading,
  error,
  refreshing,
  onRefresh,
  keyExtractor,
  renderItem,
  emptyText = 'Nothing here yet.',
  listHeader,
  listFooter,
}: Props<T>) {
  return (
    <View style={styles.root}>
      <Header title={title} right={headerRight} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          renderItem={({ item }) => renderItem(item)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: colors.primary, fontSize: 14, paddingHorizontal: 24, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary },
  retryText: { color: colors.white, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
});
