import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { CommentsPanel } from '@/components/CommentsPanel';
import { Page } from '@/components/Page';
import { ReviewForm, type ReviewDetail } from '@/components/ReviewForm';
import { ErrorText, Loading, PageHeading } from '@/components/ui';
import { useAdminData } from '@/lib/useAdminData';

// The website's /admin/[slug]/edit page: the form, then the review's comments.
export default function EditReview() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  // The list already carries every field the form needs.
  const { data, loading, error, refresh } = useAdminData<{ reviews: ReviewDetail[] }>('/api/admin/reviews');
  const review = data?.reviews.find((r) => r.slug === slug);

  return (
    <Page>
      <PageHeading title="Edit Review" />
      {loading ? (
        <Loading />
      ) : error || !review ? (
        <ErrorText message={error ?? "Couldn't find that review."} onRetry={refresh} />
      ) : (
        <>
          <View style={{ marginTop: 24 }}>
            <ReviewForm mode="edit" initial={review} />
          </View>
          <CommentsPanel slug={review.slug} />
        </>
      )}
    </Page>
  );
}
