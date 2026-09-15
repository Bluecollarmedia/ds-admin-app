import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { createVideoPlayer } from 'expo-video';

import { adminFetch } from '@/lib/api';
import { colors } from '@/lib/theme';

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
    <View style={styles.box}>
      <Text style={styles.title}>
        {items.length} video{items.length === 1 ? '' : 's'} missing a duration
      </Text>
      <Text style={styles.sub}>Measure and save each one&apos;s length so the cards show the time.</Text>
      <View style={styles.row}>
        <Pressable onPress={run} disabled={running} style={styles.btn}>
          {running ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.btnText}>
                Working… {done}/{items.length}
              </Text>
            </View>
          ) : (
            <Text style={styles.btnText}>{finished ? 'Run again' : 'Fill in all durations'}</Text>
          )}
        </Pressable>
        {finished && <Text style={styles.result}>Filled {filled}. Pull to refresh.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 14, gap: 4 },
  title: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  sub: { fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  result: { fontSize: 12, color: colors.muted },
});
