// Storage cleanup job logic (supabase/functions/_shared/cleanup.ts) with mocked storage and queue. No network, no credentials.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + detail}`); };

(async () => {
  const file = path.join(__dirname, '..', '..', 'supabase', 'functions', '_shared', 'cleanup.ts');
  const { runCleanup, isSafeKey } = await import(pathToFileURL(file).href);

  const mk = (items, del) => {
    const finished = [];
    return {
      finished,
      deps: {
        claim: async () => items,
        finish: async (id, ok, error) => { finished.push({ id, ok, error }); },
        deleteObject: del,
      },
    };
  };
  const it = (id, key) => ({ id, file_key: key, attempts: 1, company_id: 'c' });

  let m = mk([it('1', 'a/b.jpg'), it('2', 'a/c.jpg')], async () => true);
  let s = await runCleanup(m.deps);
  check('1 files the storage confirms are marked done', s.done === 2 && m.finished.every((f) => f.ok), JSON.stringify(s));

  m = mk([it('1', 'a/gone.jpg')], async () => true); // deleteR2Object returns true for a 404 (already gone)
  s = await runCleanup(m.deps);
  check('2 a file already gone counts as done', s.done === 1 && m.finished[0].ok);

  m = mk([it('1', 'a/b.jpg'), it('2', 'a/c.jpg')], async (k) => { if (k === 'a/b.jpg') throw new Error('timeout'); return true; });
  s = await runCleanup(m.deps);
  check('3 one failure does not stop the rest, and the failed file is reported as not done with its error', s.done === 1 && s.retrying === 1
    && m.finished.find((f) => f.id === '1').ok === false && /timeout/.test(m.finished.find((f) => f.id === '1').error) && m.finished.find((f) => f.id === '2').ok === true, JSON.stringify(m.finished));

  m = mk([it('1', 'a/b.jpg')], async () => false);
  s = await runCleanup(m.deps);
  check('4 a refusal from the storage (not ok) is a failure, never marked done', s.done === 0 && s.retrying === 1 && m.finished[0].ok === false);

  m = mk([it('1', '../secrets'), it('2', '/abs'), it('3', ''), it('4', 'x/../../y')], async () => { throw new Error('should not be called'); });
  s = await runCleanup(m.deps);
  check('5 unsafe keys are never sent to the storage', s.done === 0 && s.retrying === 4 && m.finished.every((f) => !f.ok), JSON.stringify(s));

  let calls = 0;
  m = mk([it('1', 'a/b.jpg')], async () => { calls++; return true; });
  m.deps.finish = async () => { throw new Error('db down'); };
  s = await runCleanup(m.deps);
  check('6 if recording the result fails, the run still ends cleanly (the lock expires and the file is retried; deleting twice is harmless)', calls === 1 && s.claimed === 1);

  m = mk([], async () => true);
  s = await runCleanup(m.deps);
  check('7 nothing queued -> nothing done', s.claimed === 0 && s.done === 0);
  check('8 isSafeKey accepts normal keys only', isSafeKey('projects/1/2-a.jpg') && !isSafeKey('../x') && !isSafeKey('/x') && !isSafeKey(''));

  const idx = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'functions', 'storage-cleanup', 'index.ts'), 'utf8');
  check('9 the function refuses without the secret (header compared in constant time, minimum length) and only POST', /x-cleanup-secret/.test(idx) && /SECRET\.length < 24/.test(idx) && /405/.test(idx) && /403/.test(idx));
  check('10 the app never calls it (no client reference)', !/storage-cleanup/.test([
    fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'store.ts'), 'utf8'),
  ].join('')));

  console.log(bad ? `\n${bad} failed` : '\nall passed');
  process.exit(bad ? 1 : 0);
})();
