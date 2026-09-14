import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Header } from '@/components/Header';
import { ReviewsScreen } from '@/screens/ReviewsScreen';
import { AccountsScreen } from '@/screens/AccountsScreen';
import { CommentsScreen } from '@/screens/CommentsScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { AppealsScreen } from '@/screens/AppealsScreen';
import { StorageScreen } from '@/screens/StorageScreen';
import { VisitorsScreen } from '@/screens/VisitorsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { colors } from '@/lib/theme';

export default function SectionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();

  switch (key) {
    case 'reviews':
      return <ReviewsScreen />;
    case 'accounts':
      return <AccountsScreen />;
    case 'comments':
      return <CommentsScreen />;
    case 'notifications':
      return <NotificationsScreen />;
    case 'appeals':
      return <AppealsScreen />;
    case 'storage':
      return <StorageScreen />;
    case 'visitors':
      return <VisitorsScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return (
        <View style={styles.root}>
          <Header title="Section" />
          <View style={styles.center}>
            <Text style={styles.note}>Unknown section.</Text>
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 15, color: colors.muted },
});
