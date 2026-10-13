import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Page } from '@/components/Page';
import { Button, Card, Input, PageHeading, T } from '@/components/ui';
import { adminFetch } from '@/lib/api';
import { useAdminData } from '@/lib/useAdminData';
import { fg, tw } from '@/lib/theme';

// The website's /admin/push page (PushComposer).
export function PushScreen() {
  const { data, refreshing, refresh } = useAdminData<{ recipientCount: number }>('/api/admin/push');
  const recipientCount = data?.recipientCount ?? 0;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;
  const people = `${recipientCount} ${recipientCount === 1 ? 'person' : 'people'}`;

  function handleSend() {
    if (!canSend) return;
    Alert.alert(`Send this notification to ${people} right now?`, `"${title}"\n${body}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: send },
    ]);
  }

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminFetch('/api/admin/push', {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error ?? 'Failed to send.');
      } else {
        setResult({ sent: d.sent, failed: d.failed });
        setTitle('');
        setBody('');
      }
    } catch {
      setError('Network error — nothing was sent.');
    }
    setSending(false);
  }

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <PageHeading
        title="Push Notification"
        descriptionSize="sm"
        description="Send a one-off push notification to everyone who has the app installed and notifications enabled — a re-engagement nudge, an announcement, whatever you want."
      />

      <Card style={{ marginTop: 24, padding: 20 }}>
        <T size="sm" color={fg(0.6)}>
          This sends an immediate push notification to every device with notifications enabled —{' '}
          <T size="sm" weight="semibold">
            {people}
          </T>{' '}
          right now.
        </T>

        <View style={{ marginTop: 16, gap: 12 }}>
          <View>
            <T size="xs" weight="semibold" color={fg(0.6)}>
              Title
            </T>
            <Input
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              placeholder="Hey, we miss you!"
              style={{ marginTop: 4, borderRadius: 12 }}
            />
          </View>
          <View>
            <T size="xs" weight="semibold" color={fg(0.6)}>
              Message
            </T>
            <Input
              value={body}
              onChangeText={setBody}
              maxLength={180}
              multiline
              placeholder="Forgot about us? New reviews are up."
              style={{ marginTop: 4, borderRadius: 12, minHeight: 76 }}
            />
          </View>
        </View>

        {error && (
          <T size="sm" weight="semibold" color="#dc2626" style={{ marginTop: 12 }}>
            {error}
          </T>
        )}
        {result && (
          <T size="sm" weight="semibold" color={tw.emerald600} style={{ marginTop: 12 }}>
            Sent to {result.sent} {result.sent === 1 ? 'device' : 'devices'}
            {result.failed > 0 ? ` (${result.failed} failed)` : ''}.
          </T>
        )}

        <Button
          variant="primary"
          size="sm"
          label={sending ? 'Sending…' : 'Send Notification'}
          onPress={handleSend}
          disabled={!canSend}
          style={{ marginTop: 16, alignSelf: 'flex-start', paddingVertical: 8, opacity: canSend ? 1 : 0.4 }}
        />
      </Card>
      <View style={{ height: 1 }} />
    </Page>
  );
}
