import { useState } from 'react';
import { View } from 'react-native';
import { createVideoPlayer } from 'expo-video';

import { adminFetch } from '@/lib/api';
import { Button, Card, T } from '@/components/ui';
import { fg } from '@/lib/theme';

type Item = { slug: string; videoUrl: string };

// Measure a video's length without downloading the whole file, using expo-video's
// standalone player (no visible <VideoView> needed) — the native equivalent of
// the web tool's hidden <video> element.
function readDuration(url: string, timeoutMs = 15000): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    const player = createVideoPlayer(url);
    const finish = (val: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.remove();
      try {
        player.release();
      } catch {
        // ignore
      }
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        const d = player.duration;
        finish(Number.isFinite(d) && d > 0 ? d : null);
      } else if (status === 'error') {
        finish(null);
      }
    });
  });
}

export function BackfillDurations({ items }: { items: Item[] }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [filled, setFilled] = useState(0);
  const [finished, setFinished] = useState(false);

  async function run() {
    setRunning(true);
    setDone(0);
    setFilled(0);
    setFinished(false);
    let f = 0;
    // One at a time, same as the web tool — reliable and easy on bandwidth.
    for (let i = 0; i < items.length; i++) {
      const dur = await readDuration(items[i].videoUrl);
      if (dur) {
        try {
          const res = await adminFetch(`/api/reviews/${items[i].slug}/duration`, {
            method: 'POST',
            body: JSON.stringify({ seconds: dur }),
          });
          const d = await res.json().catch(() => null);
          if (d?.updated) f++;
        } catch {
          // ignore and continue
        }
      }
      setDone(i + 1);
      setFilled(f);
    }
    setFinished(true);
    setRunning(false);
  }

  if (items.length === 0) return null;

  return (
    <Card style={{ padding: 16, marginBottom: 24 }}>
      <T size="sm" weight="semibold">
        {items.length} video{items.length === 1 ? '' : 's'} missing a duration
      </T>
      <T size="xs" color={fg(0.55)} style={{ marginTop: 2 }}>
        Measure and save each one&apos;s length so the cards show the time.
      </T>
      <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Button
          variant="primary"
          size="sm"
          style={{ paddingHorizontal: 16, paddingVertical: 8 }}
          onPress={run}
          disabled={running}
          label={running ? `Working… ${done}/${items.length}` : finished ? 'Run again' : 'Fill in all durations'}
        />
        {finished && (
          <T size="sm" color={fg(0.7)}>
            Filled {filled}. Pull down to refresh.
          </T>
        )}
      </View>
    </Card>
  );
}
