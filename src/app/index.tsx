import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { getToken } from '@/lib/session';
import { colors } from '@/lib/theme';

// Entry point: decide where to send the admin based on whether they're logged in.
export default function Index() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    getToken().then((t) => {
      setSignedIn(!!t);
      setChecked(true);
    });
  }, []);

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={signedIn ? '/dashboard' : '/login'} />;
}
