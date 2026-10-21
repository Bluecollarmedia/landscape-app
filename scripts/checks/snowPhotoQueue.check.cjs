// Run: node scripts/checks/snowPhotoQueue.check.cjs
// Snow stop photos use the shared background queue: adding them returns at once (nothing spins), they upload and save in the
// background, a failure shows Retry/Remove, and Finish Stop waits (a little) for photos that are still uploading.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  - ' + d}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const q = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'lib', 'mediaQueue.ts')).href);

  // The real queue engine with a Snow job and fake storage / network.
  const calls = { upload: [], record: [] };
  let failRecord = false;
  const queue = new q.MediaQueue({
    load: async () => [], save: async () => {},
    adopt: async (j) => j.sourceUri,
    prepare: async (j) => ({ uri: j.sourceUri, bytes: 300_000 }),
    upload: async (j, uri) => { calls.upload.push([j.target.type, j.folder, uri]); return { url: '', key: `${j.folder}/k1.jpg` }; },
    complete: async (j, up) => { if (failRecord) throw new Error('Network request failed'); calls.record.push([j.target.payload.visitId, up.key]); },
    removeStored: async () => {}, cleanup: async () => {},
    backoffMs: () => 5, later: (fn, ms) => setTimeout(fn, ms),
  });
  const job = queue.enqueue({ kind: 'image', sourceUri: 'file:///a.jpg', mimeType: 'image/jpeg', folder: 'co1/completion/v1', target: { type: 'snow_completion', payload: { visitId: 'v1' } } });
  check('1 adding a Snow photo returns at once, before anything has uploaded', job.status === 'preparing' && calls.upload.length === 0);
  await queue.idle();
  check('2 it then uploads to the stop\'s completion folder and saves the record on that stop', queue.get(job.id).status === 'uploaded' && calls.upload[0][1] === 'co1/completion/v1' && calls.record[0][0] === 'v1' && calls.record[0][1].startsWith('co1/completion/v1/'), JSON.stringify(calls));
  const dup = queue.enqueue({ kind: 'image', sourceUri: 'file:///a.jpg', mimeType: 'image/jpeg', folder: 'co1/completion/v1', target: { type: 'snow_completion', payload: { visitId: 'v1' } } });
  check('3 a double tap on the same photo does not make a second job', dup.id === job.id && queue.list().length === 1);

  // A bad connection is retried by itself, then offers Retry; it never hangs.
  failRecord = true;
  const j2 = queue.enqueue({ kind: 'image', sourceUri: 'file:///b.jpg', mimeType: 'image/jpeg', folder: 'co1/completion/v2', target: { type: 'snow_completion', payload: { visitId: 'v2' } } });
  for (let i = 0; i < 60 && queue.get(j2.id).status !== 'failed'; i++) await sleep(10);
  check('4 with no connection it retries itself, then shows Failed (so the screen can offer Retry)', queue.get(j2.id).status === 'failed' && !!queue.get(j2.id).error, JSON.stringify(queue.get(j2.id)));
  failRecord = false; queue.retry(j2.id); await queue.idle();
  check('5 Retry saves it once the connection is back, without uploading the file twice', queue.get(j2.id).status === 'uploaded' && calls.upload.filter((u) => u[1] === 'co1/completion/v2').length === 1, JSON.stringify(calls.upload));

  // Wiring in the app.
  const routes = read('src/data/snowRoutes.ts');
  const runtime = read('src/lib/mediaQueueRuntime.ts');
  const screen = read('src/components/snow/routes/MyRouteScreen.tsx');
  const add = routes.slice(routes.indexOf('export async function addCompletionMedia'), routes.indexOf('export const SNOW_COMPLETION_TARGET'));
  check('6 addCompletionMedia only queues: no upload or record call inside it, so it cannot spin', /queueMedia\(/.test(add) && !/await uploadSnowMedia|supabase\.rpc|await /.test(add.replace('export async function', '')), add.slice(0, 200));
  check('7 the queue sends Snow photos to the private snow bucket and saves them with the stop RPC', /uploadSnowMedia\(uri, job\.folder/.test(runtime) && /saveCompletionRecord/.test(runtime) && /snow_add_completion_media/.test(routes) && /discardSnowUpload/.test(runtime));
  check('8 the stop screen does not wait on the upload when photos are added', !/act\(\(\) => addCompletionMedia/.test(screen) && /await addCompletionMedia\(/.test(screen));
  check('9 the stop screen says photos are uploading in the background and offers Retry and Remove on a failure', /uploading in the background/.test(screen) && /mediaQueue\.retry/.test(screen) && /mediaQueue\.cancel/.test(screen));
  check('10 photos still uploading count as added; failed ones block Finish Stop until retried or removed', /addedCount = \(current\?\.mediaCount \?\? 0\) \+ uploading\.length/.test(screen) && /needMedia > 0 \|\| failedJobs\.length > 0/.test(screen));
  check('11 Finish Stop waits (up to 90 s) for photos still uploading, then says so plainly instead of spinning', /waitForMediaJobs\(uploading\.map/.test(screen) && /90_000/.test(screen) && /still uploading/.test(screen));
  check('12 the queue name is shared, not retyped', /SNOW_COMPLETION_TARGET/.test(screen) && /snow_completion/.test(runtime));
  console.log(bad ? `\n${bad} failed` : '\nall passed');
  process.exit(bad ? 1 : 0);
})();
