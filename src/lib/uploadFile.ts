/**
 * Sends one local file to a short-lived upload link (an HTTP PUT), the way each platform does it best.
 *
 * On a PHONE the file goes up through the operating system's own file upload (expo-file-system: the file is streamed straight from
 * disk by the native networking layer). It never goes through JavaScript's fetch + Blob, which is the unreliable part on a phone: a
 * Blob made from a file address can arrive empty or never send, with a vague "network request failed". On the WEB the browser's
 * fetch with a Blob is the right tool and is what already works there.
 *
 * Returns what the storage server answered, so the caller can show its real reason. Never throws for an HTTP answer; throws only
 * when the request could not be made at all (and says what failed).
 */
import { Platform } from 'react-native';
import { withTimeout } from './mediaQueue';

export interface PutResult { status: number; body: string }

export async function putFile(localUri: string, url: string, contentType: string, timeoutMs: number): Promise<PutResult> {
  if (Platform.OS === 'web') {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), timeoutMs);
    try {
      const blob = await (await fetch(localUri)).blob();
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob, signal: stop.signal });
      return { status: res.status, body: await res.text().catch(() => '') };
    } catch (err) {
      throw new Error(stop.signal.aborted ? `Sending the file timed out after ${Math.round(timeoutMs / 1000)} seconds` : `Sending the file failed (${err instanceof Error ? err.message : String(err)})`);
    } finally {
      clearTimeout(timer);
    }
  }

  const { File } = require('expo-file-system') as typeof import('expo-file-system');
  let file: InstanceType<typeof File>;
  try {
    file = new File(localUri);
    if (!file.exists) throw new Error('the file is gone');
  } catch (err) {
    throw new Error(`The phone could not read the file (${err instanceof Error ? err.message : String(err)})`);
  }
  const task = file.createUploadTask(url, { httpMethod: 'PUT', headers: { 'Content-Type': contentType } });
  try {
    const res = await withTimeout(task.uploadAsync(), timeoutMs, () => {
      try { task.cancel(); } catch { /* already finished */ }
      return new Error(`Sending the file timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    });
    return { status: res.status, body: res.body ?? '' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(/timed out/.test(msg) ? msg : `Sending the file failed (${msg})`);
  }
}

/** The size of a local file in bytes, or undefined when it cannot be read. Phone: from disk; web: from the Blob. */
export async function localFileSize(localUri: string): Promise<number | undefined> {
  try {
    if (Platform.OS === 'web') return (await (await fetch(localUri)).blob()).size;
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    return new File(localUri).size ?? undefined;
  } catch {
    return undefined;
  }
}
