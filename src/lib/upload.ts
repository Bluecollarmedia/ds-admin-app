import * as FileSystem from 'expo-file-system/legacy';

import { adminJson } from './api';

// Upload a local file to R2 via a presigned PUT from the admin API, and return
// the stored key. The file bytes go straight to R2 — never through the app's
// own memory as a blob — so large videos upload reliably.
export async function uploadToR2(
  fileUri: string,
  filename: string,
  contentType: string,
  folder: 'videos' | 'thumbnails'
): Promise<string> {
  const { uploadUrl, key } = await adminJson<{ uploadUrl: string; key: string }>('/api/admin/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType, folder }),
  });

  const res = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed (${res.status})`);
  }
  return key;
}
