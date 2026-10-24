// Run: node scripts/checks/taskPhotoKeptAtPick.check.cjs
// A task photo is copied into the app's own folder the moment it is picked (before the storage check), so the phone clearing the picker's
// temporary copy can no longer leave the upload with "the file is gone". The error also names the file when it still happens.
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + detail}`); };
const tm = read('src/data/taskMedia.ts');
check('1 each picked file is copied into the app folder (media-queue) as soon as it is picked', /function keepPickedFile/.test(tm) && /new File\(uri\)\.copy\(dest\)/.test(tm) && /'media-queue'/.test(tm));
check('2 the copy happens before the storage check', tm.indexOf('keepPickedFile(asset.uri') > 0 && tm.indexOf('keepPickedFile(asset.uri') < tm.indexOf('await storageProblem('));
check('3 a file that cannot be read is turned away with a message, not queued', /couldn't be read from your phone/.test(tm));
check('4 the queue leaves a file already in the app folder where it is (no second copy)', /includes\('\/media-queue\/'\)/.test(read('src/lib/mediaQueue.ts')));
check('5 the "file is gone" error says which file', /\.\.\.\$\{localUri\.slice\(-48\)\}/.test(read('src/lib/uploadFile.ts')));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
