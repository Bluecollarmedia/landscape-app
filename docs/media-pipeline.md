# Photos and videos: one pipeline

Every photo and video that leaves the phone goes through the same steps. Rules live in `src/lib/mediaPlan.ts` (tested without a phone).

**Photos** are compressed before upload: JPEG at quality 0.5, long side at most 1600 px, never enlarged, orientation and aspect ratio kept
(expo-image-manipulator). A JPEG/WebP that is already small (<= 250 KB, <= 1600 px) is not recompressed; HEIC/PNG is converted. The picker
hands over the original (quality 1) so there is only one lossy step.

**Videos** are compressed to at most 854x480 (480x854 portrait), ratio kept, even sizes, 0.6 - 1.5 Mbps, audio kept, using
`react-native-compressor` 1.19.4 (added to package.json and the lockfile; the 1.x line, which supports the new architecture and does not need
Nitro; requires Node 22.11+ to install). It is a native library: **it takes effect only in a new app build** (`npm ci` then an EAS build, which
needs the owner's go-ahead), and it has not yet been run on any device. A build made without it, or a failed compression, shows a clear message and
the person chooses Retry or "Original" (uploads the large original); nothing is skipped silently. The 50 MB / 60 s limits in the pickers still
apply BEFORE compression; move them after compression once video compression has been verified on devices.

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

## Making maintenance, Snow and ID files private (private bucket)

Files for `{company}/maintenance/`, `{company}/reference/`, `{company}/completion/` and `ids/` live in a second R2 bucket that has no public
address (secret `R2_PRIVATE_BUCKET_NAME`); everything else stays in the public bucket. The app opens private files through short-lived signed links
from the `media` function (`maint-sign` for maintenance photos: owner/admin, crew on the route, or the linked customer for a shared photo on a
finished stop; Snow and ID photos keep their own checks). Without `R2_PRIVATE_BUCKET_NAME` everything behaves as before.

Order (each step needs the owner's go-ahead; do them in this order):
1. Cloudflare: create `brighton-private` (public access OFF); give the API token access to it; add the Supabase secret. (done)
2. Run SQL 71 and 73 in Supabase (they only add/replace functions).
3. Deploy the `media` function (new code: private bucket support + `maint-sign`).
4. Build and release an app version that opens maintenance photos through signed links. Older app versions show maintenance photos from their
   stored public address, which stops working once the originals are removed in step 6.
5. Add secret `MIGRATE_SECRET`, deploy `private-migrate`, run it as a dry run, then with `dryRun:false` (COPIES; the originals stay public).
   Repeat with each `next` token until it is empty. Check `failed` is empty.
6. After every phone has the new app version: run it again with `dryRun:false, deleteOriginals:true` (verifies each copy, then removes the public
   original). Then open an old maintenance photo address in a browser: it must say the object does not exist or is not allowed.
7. Delete the `private-migrate` function and its secret.
