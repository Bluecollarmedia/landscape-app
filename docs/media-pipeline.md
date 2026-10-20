# Photos and videos: one pipeline

Every photo and video that leaves the phone goes through the same steps. Rules live in `src/lib/mediaPlan.ts` (tested without a phone).

**Photos** are compressed before upload: JPEG at quality 0.5, long side at most 1600 px, never enlarged, orientation and aspect ratio kept
(expo-image-manipulator). A JPEG/WebP that is already small (<= 250 KB, <= 1600 px) is not recompressed; HEIC/PNG is converted. The picker
hands over the original (quality 1) so there is only one lossy step.

**Videos** are meant to be compressed to at most 854x480 (480x854 portrait), ratio kept, even sizes, 0.6 - 1.5 Mbps, audio kept.
**This needs a native library that is not in the app yet** (`react-native-compressor`; its 2.x line also needs `react-native-nitro-modules`;
the app must be rebuilt, which needs the owner's approval). Until then a video fails with a clear message and the person chooses Retry or
"Original" (uploads the large original). Nothing is skipped silently. The 50 MB / 60 s limits in the pickers still apply BEFORE compression;
they should be moved after compression once video compression exists.

**The queue** (`src/lib/mediaQueue.ts`, phone wiring `mediaQueueRuntime.ts`) is used by project progress photos, maintenance stop photos
and task photos/videos: pick several at once, the local file is shown immediately, and each item moves Preparing -> Uploading -> Uploaded
(storage AND the database record confirmed) or Failed (Retry / Original / Remove). At most 3 run at once (1 video). Pending work is saved
in AsyncStorage and resumes after leaving a screen or restarting the app. Network trouble retries automatically (4 tries, growing delay), then shows
Failed. If the file is stored but the record fails, only the record is retried; cancelling then deletes the stored file. Double taps make one job.
Honest limits: iOS/Android can suspend the app, and uploads pause until it is opened again; an interrupted upload restarts from the
beginning; there is no upload while the app is closed.

**Not in the queue, by design:**
- Required start/finish photos for timed visits (`timePhotos.ts`): the visit step must wait for the saved photo, so they upload and save in one
  step; they are compressed by `uploadImage` like everything else.
- Snow media (`snowMedia.ts`): different storage model (stand-in object + private bucket decided by database rules, records created by
  Snow functions). Photos are compressed there too; moving Snow into the queue is a separate piece of work.
- Avatars, ID photos, truck documents, issue photos, project header, private notes: single uploads through `uploadImage` (photos compressed).

Sharing: a maintenance photo is always saved internal; compression and uploading never change who can see it.
