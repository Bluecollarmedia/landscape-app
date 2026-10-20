// The one-time "move private files to the private bucket" logic, with fake buckets. No network, no real storage.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  - ' + d}`); };
(async () => {
  const { migratePrivate } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'supabase', 'functions', '_shared', 'migratePrivate.ts')).href);
  const mk = (over = {}) => {
    const pub = new Map([
      ['co1/maintenance/p1/a.jpg', 100], ['co1/maintenance/p1/b.jpg', 200], ['co1/projects/p/c.jpg', 300], ['ids/u1/id.jpg', 50],
      ['avatars/u1/me.jpg', 10], ['co1/reference/s1/v.mp4', 900], ['co1/completion/v1/x.jpg', 70],
    ]);
    const priv = new Map();
    const log = { copies: 0, deletes: [] };
    const deps = {
      listPublic: async () => ({ keys: [...pub.keys()] }),
      sizePublic: async (k) => pub.get(k),
      sizePrivate: async (k) => priv.get(k),
      copyToPrivate: async (k) => { log.copies++; priv.set(k, pub.get(k)); },
      deletePublic: async (k) => { log.deletes.push(k); pub.delete(k); },
      ...over,
    };
    return { pub, priv, log, deps };
  };

  let t = mk();
  let r = await migratePrivate(t.deps, {});
  check('1 the default run is a dry run: it counts the private files (5) and changes nothing', r.dryRun && r.privateCandidates === 5 && t.log.copies === 0 && t.priv.size === 0 && t.pub.size === 7, JSON.stringify(r));

  t = mk(); r = await migratePrivate(t.deps, { dryRun: false });
  check('2 a copy run copies ONLY the private files (maintenance, reference, completion, ids), leaves public ones, and deletes nothing', r.copied === 5 && t.priv.size === 5 && !t.priv.has('co1/projects/p/c.jpg') && !t.priv.has('avatars/u1/me.jpg') && t.pub.size === 7 && r.deleted === 0);

  t = mk(); r = await migratePrivate(t.deps, { dryRun: false, deleteOriginals: true });
  check('3 with deleteOriginals the verified originals are removed from the public bucket; public files stay', r.copied === 5 && r.deleted === 5 && t.pub.size === 2 && [...t.pub.keys()].every((k) => k.startsWith('co1/projects') || k.startsWith('avatars')));

  t = mk(); await migratePrivate(t.deps, { dryRun: false });
  r = await migratePrivate(t.deps, { dryRun: false, deleteOriginals: true });
  check('4 running again is harmless: already-copied files are not copied twice, then the originals are removed', r.alreadyMoved === 5 && r.copied === 0 && r.deleted === 5 && t.log.copies === 5);

  t = mk({ copyToPrivate: async (k) => { /* copy "succeeds" but is the wrong size */ } });
  t.deps.copyToPrivate = async (k) => { t.priv.set(k, 1); };
  r = await migratePrivate(t.deps, { dryRun: false, deleteOriginals: true });
  check('5 a copy that is missing or a different size is NEVER followed by deleting the original', r.deleted === 0 && r.failed.length === 5 && t.pub.size === 7, JSON.stringify(r.failed[0]));

  t = mk({ copyToPrivate: async () => { throw new Error('Copy failed (500)'); } });
  r = await migratePrivate(t.deps, { dryRun: false, deleteOriginals: true });
  check('6 a failed copy is reported per file, keeps the original, and does not stop the rest', r.failed.length === 5 && r.deleted === 0 && t.pub.size === 7);

  t = mk(); let flaky = 0;
  const origCopy = t.deps.copyToPrivate;
  t.deps.copyToPrivate = async (k) => { if (flaky++ === 1) throw new Error('boom'); await origCopy(k); };
  r = await migratePrivate(t.deps, { dryRun: false, deleteOriginals: true });
  check('7 one failure among several: the others are still moved and deleted, only the failed one stays public (and is listed)', r.failed.length === 1 && r.deleted === 4 && r.copied === 4 && t.pub.size === 3, JSON.stringify(r));

  const paged = { listPublic: async (token) => (token ? { keys: ['co1/maintenance/p1/z.jpg'] } : { keys: ['co1/maintenance/p1/y.jpg'], next: 'T2' }), sizePublic: async () => 5, sizePrivate: async () => 5, copyToPrivate: async () => {}, deletePublic: async () => {} };
  r = await migratePrivate(paged, { dryRun: false });
  check('8 it handles one page at a time and returns where to continue', r.next === 'T2' && (await migratePrivate(paged, { token: 'T2', dryRun: false })).next === undefined);
  console.log(bad ? `\n${bad} failed` : '\nall passed');
  process.exit(bad ? 1 : 0);
})();
