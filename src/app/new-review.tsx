import { View } from 'react-native';

import { Header } from '@/components/Header';
import { ReviewForm } from '@/components/ReviewForm';
import { colors } from '@/lib/theme';

export default function NewReview() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="New Review" />
      <ReviewForm mode="create" />
    </View>
  );
}
