import { View } from 'react-native';

import { Page } from '@/components/Page';
import { ReviewForm } from '@/components/ReviewForm';
import { PageHeading } from '@/components/ui';

// The website's /admin/new page.
export default function NewReview() {
  return (
    <Page>
      <PageHeading title="Add New Review" />
      <View style={{ marginTop: 24 }}>
        <ReviewForm mode="create" />
      </View>
    </Page>
  );
}
