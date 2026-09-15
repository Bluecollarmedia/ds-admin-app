import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Header } from '@/components/Header';
import { ReviewForm, type ReviewDetail } from '@/components/ReviewForm';
import { useAdminData } from '@/lib/useAdminData';
import { colors } from '@/lib/theme';

export default function EditReview() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  // Reuse the list endpoint and find this one — avoids a second API route just
  // for a single review, and the list already carries every field the form needs.
  const { data, loading, error } = useAdminData<{ reviews: ReviewDetail[] }>('/api/admin/reviews');
  const review = data?.reviews.find((r) => r.slug === slug);

  return (
    <View style={styles.root}>
      <Header title="Edit Review" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error || !review ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? "Couldn't find that review."}</Text>
        </View>
      ) : (
        <ReviewForm mode="edit" initial={review} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.primary, fontSize: 14, textAlign: 'center' },
});
