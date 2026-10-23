// Run: node scripts/checks/adminJobCard.check.cjs
// An ADMIN who is put on a job works it like a worker from their dashboard: sees the job, confirms it, and has Clock In / Clock Out.
// The owner never gets this card (the owner is not put on jobs).
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + detail}`); };
const card = read('src/components/admin/AdminJobCard.tsx');
const home = read('app/(owner)/(tabs)/index.tsx');
check('1 only an admin sees it (never the owner)', /user\?\.role === 'admin'/.test(card));
check('2 only today\'s open jobs of the signed-in person count', /a\.personId === user\.id && a\.scheduledDate === today && !\['completed', 'cancelled', 'reassigned'\]\.includes\(a\.status\)/.test(card));
check('3 with no job today it shows nothing', /if \(!mine\.length\) return null/.test(card));
check('4 the admin can confirm the job', /updateRow\('assignments', a\.id, \{ confirmationState: 'confirmed' \}\)/.test(card));
check('5 the admin gets the same workday clock as a worker (Clock In / Clock Out)', /<WorkerProvider>/.test(card) && /<WorkdayCard compact \/>/.test(card));
check('6 it sits on the dashboard above Needs Attention', /<AdminJobCard \/>\s*\{\/\* Needs Attention \*\/\}/.test(home));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
