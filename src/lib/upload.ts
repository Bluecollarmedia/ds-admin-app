import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { adminJson } from './api';

// Upload a local file to R2 via a presigned PUT from the admin API, and return
// the stored key. The file bytes go straight to R2 — never through the app's
// own memory as a blob — so large videos upload reliably.
export async function uploadToR2(
  fileUri: string,
  filename: string,
  contentType: string,
  folder: 'videos' | 'thumbnails',
  onProgress?: (percent: number) => void
): Promise<string> {
  const { uploadUrl, key } = await adminJson<{ uploadUrl: string; key: string }>('/api/admin/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType, folder }),
  });

  const task = FileSystem.createUploadTask(
    uploadUrl,
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (onProgress && totalBytesExpectedToSend > 0) {
        onProgress(Math.round((totalBytesSent / totalBytesExpectedToSend) * 100));
      }
    }
  );
  const res = await task.uploadAsync();

  if (!res || res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed (${res?.status ?? 'cancelled'})`);
  }
  return key;
}

// The website keeps a small (640px) copy of every thumbnail at
// `thumbnails-small/<key>` so lists load fast. Make that copy from a local (or
// remote) image and upload it next to the full one. `width`/`height` are the
// source's size, so only the longer side is scaled down.
export async function uploadSmallThumbnail(
  imageUri: string,
  thumbnailKey: string,
  size?: { width: number; height: number }
): Promise<void> {
  let localUri = imageUri;
  if (/^https?:/.test(imageUri)) {
    const dl = await FileSystem.downloadAsync(imageUri, `${FileSystem.cacheDirectory}small-src-${Date.now()}`);
    if (dl.status < 200 || dl.status >= 300) throw new Error('Download failed');
    localUri = dl.uri;
  }
  let w = size?.width;
  let h = size?.height;
  if (!w || !h) {
    const probe = await manipulateAsync(localUri, []);
    w = probe.width;
    h = probe.height;
  }
  const resize = w >= h ? { width: Math.min(640, w) } : { height: Math.min(640, h) };
  const small = await manipulateAsync(localUri, [{ resize }], { compress: 0.75, format: SaveFormat.WEBP });

  const { uploadUrl } = await adminJson<{ uploadUrl: string; key: string }>('/api/admin/upload-url', {
    method: 'POST',
    body: JSON.stringify({ folder: 'thumbnails-small', sourceKey: thumbnailKey }),
  });
  const res = await FileSystem.uploadAsync(uploadUrl, small.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'image/webp' },
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status})`);
}
