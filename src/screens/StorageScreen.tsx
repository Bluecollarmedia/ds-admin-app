import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { Page } from '@/components/Page';
import { Button, Card, Display, ErrorText, Loading, T } from '@/components/ui';
import { adminFetch } from '@/lib/api';
import { uploadSmallThumbnail } from '@/lib/upload';
import { useAdminData } from '@/lib/useAdminData';
import { colors, fg, fonts, WEBSITE_URL } from '@/lib/theme';

type BucketFile = { key: string; size: number; lastModified: string; url: string | null };
type StorageData = {
  totalFiles: number;
  orphaned: BucketFile[];
  orphanedBytes: number;
  missingSmall?: { key: string; url: string | null }[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function fileName(key: string): string {
  return key.split('/').pop() ?? key;
}

const SECTIONS: { prefix: string; label: string; isImage: boolean }[] = [
  { prefix: 'videos/', label: 'Videos', isImage: false },
  { prefix: 'thumbnails/', label: 'Thumbnails', isImage: true },
  { prefix: 'avatars/', label: 'Avatars', isImage: true },
  { prefix: 'comment-images/', label: 'Comment Photos', isImage: true },
];

// The website's /admin/storage page (AdminSmallThumbnails + AdminStorageList).
export function StorageScreen() {
  const { data, loading, refreshing, error, refresh } = useAdminData<StorageData>('/api/admin/storage');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  function handleDelete(key: string) {
    Alert.alert('Delete this file from the bucket?', `${fileName(key)}\n\nThis can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(key);
          try {
            const res = await adminFetch('/api/admin/storage/delete', {
              method: 'DELETE',
              body: JSON.stringify({ key }),
            });
            if (res.ok) {
              setRemoved((prev) => new Set(prev).add(key));
            } else {
              const d = await res.json().catch(() => null);
              Alert.alert(d?.error ?? 'Failed to delete.');
            }
          } catch {
            Alert.alert('Failed to delete.');
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  }

  const orphaned = data?.orphaned ?? [];
  const visible = orphaned.filter((f) => !removed.has(f.key));

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.heading}>
        <Display>Storage</Display>
        <Button
          size="sm"
          style={{ paddingHorizontal: 16, paddingVertical: 8 }}
          label="Compress videos →"
          onPress={() => Linking.openURL(`${WEBSITE_URL}/admin/compress`)}
        />
      </View>
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorText message={error ?? "Couldn't load storage."} onRetry={refresh} />
      ) : (
        <>
          <T size="base" color={fg(0.6)} style={{ marginTop: 4 }}>
            {data.totalFiles} files in the bucket (videos, thumbnails, avatars, comment photos/videos) ·{' '}
            {orphaned.length} not linked to anything, using {formatBytes(data.orphanedBytes)}.
          </T>

          <SmallThumbnails missing={data.missingSmall ?? []} onDone={refresh} />

          {visible.length === 0 ? (
            <T size="base" color={fg(0.6)} style={{ marginTop: 32, textAlign: 'center' }}>
              Nothing unused — every file in the bucket is linked to something.
            </T>
          ) : (
            <View style={{ marginTop: 24, gap: 32 }}>
              {SECTIONS.map((section) => {
                const files = visible.filter((f) => f.key.startsWith(section.prefix));
                if (files.length === 0) return null;
                const bytes = files.reduce((sum, f) => sum + f.size, 0);
                return (
                  <View key={section.prefix}>
                    <View style={styles.sectionHead}>
                      <Display size="xl">{section.label}</Display>
                      <T size="xs" color={fg(0.5)}>
                        {files.length} · {formatBytes(bytes)}
                      </T>
                    </View>
                    <View style={{ gap: 8 }}>
                      {files.map((file) => (
                        <FileRow
                          key={file.key}
                          file={file}
                          isImage={section.isImage}
                          deleting={deleting === file.key}
                          onDelete={() => handleDelete(file.key)}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </Page>
  );
}

function SmallThumbnails({ missing, onDone }: { missing: { key: string; url: string | null }[]; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);

  async function handleRun() {
    setRunning(true);
    setDone(0);
    setFailed(0);
    for (const item of missing) {
      try {
        if (!item.url) throw new Error('No URL');
        await uploadSmallThumbnail(item.url, item.key);
        setDone((n) => n + 1);
      } catch {
        setFailed((n) => n + 1);
      }
    }
    setRunning(false);
    onDone();
  }

  return (
    <Card style={{ marginTop: 24, padding: 16 }}>
      <T size="base" weight="semibold">
        Small thumbnails
      </T>
      <T size="sm" color={fg(0.6)} style={{ marginTop: 4 }}>
        {missing.length === 0
          ? 'Every thumbnail has its small copy, so lists and grids load fast.'
          : `${missing.length} thumbnail${missing.length === 1 ? " doesn't" : "s don't"} have a small copy yet. Without one, the site loads the full-size image there.`}
      </T>
      {missing.length > 0 && (
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Button
            variant="primary"
            size="sm"
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            label={running ? 'Making small copies…' : 'Make small copies'}
            disabled={running}
            onPress={handleRun}
          />
          {(running || done > 0 || failed > 0) && (
            <T size="sm" color={fg(0.6)}>
              {done} of {missing.length} done{failed > 0 ? ` · ${failed} failed` : ''}
            </T>
          )}
        </View>
      )}
    </Card>
  );
}

function FileRow({
  file,
  isImage,
  deleting,
  onDelete,
}: {
  file: BucketFile;
  isImage: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <Card style={styles.fileRow}>
      <View style={styles.preview}>
        {isImage && file.url ? (
          <Image source={{ uri: file.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={fg(0.4)} strokeWidth={2}>
            <Path d="M8 5v14l11-7z" />
          </Svg>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size="sm" weight="semibold" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
          {fileName(file.key)}
        </T>
        <T size="xs" color={fg(0.5)}>
          {formatBytes(file.size)} · uploaded {new Date(file.lastModified).toLocaleDateString()}
        </T>
      </View>
      <Button variant="outlinePrimary" label={deleting ? 'Deleting...' : 'Delete'} disabled={deleting} onPress={onDelete} />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sectionHead: { marginBottom: 8, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  preview: {
    width: 96,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: fg(0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
