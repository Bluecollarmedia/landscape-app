// Run: node scripts/checks/snowTeam.check.cjs <path to typescript package>
// Logic checks for the Snow Team screen helpers (src/lib/snowTeam.ts).
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/lib/snowTeam.ts'), 'utf8');
const m = { exports: {} };
new Function('module', 'exports', ts.transpileModule(src, { compilerOptions: { module: 'commonjs' } }).outputText)(m, m.exports);
const { workersToOfferSnow, pageOf } = m.exports;

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + detail}`); };
const mem = (personId, role, status, last = 'Z', first = 'A') => ({ personId, role, status, person: { firstName: first, lastName: last } });

const members = [
  mem('w1', 'worker', 'active', 'Young', 'Will'),
  mem('w2', 'worker', 'active', 'Adams', 'Amy'),
  mem('w3', 'worker', 'active', 'Brown', 'Bo'),   // already on snow (active)
  mem('w4', 'worker', 'active', 'Cole', 'Cy'),    // snow access was removed
  mem('w5', 'worker', 'inactive', 'Dane', 'Di'),  // deactivated landscaping worker
  mem('o1', 'owner', 'active', 'Boss', 'Olive'),
  mem('a1', 'admin', 'active', 'Chief', 'Adam'),
  mem('c1', 'customer', 'active', 'Cust', 'Cy'),
  { personId: 'w6', role: 'worker', status: 'active' }, // no person record loaded
  mem('w2', 'worker', 'active', 'Adams', 'Amy'),  // duplicate row
];
const snow = [{ personId: 'w3', status: 'active' }, { personId: 'w4', status: 'revoked' }];
const offer = workersToOfferSnow(members, snow);

check('1 offers active landscaping workers without snow access', offer.map((x) => x.personId).join() === 'w2,w1', offer.map((x) => x.personId).join());
check('2 does not offer workers already on the snow team', !offer.some((x) => x.personId === 'w3'));
check('3 does not offer removed snow workers (they are restored from the team list)', !offer.some((x) => x.personId === 'w4'));
check('4 does not offer deactivated workers, owners, admins or customers', !offer.some((x) => ['w5', 'o1', 'a1', 'c1'].includes(x.personId)));
check('5 a worker with no loaded person record is not offered', !offer.some((x) => x.personId === 'w6'));
check('6 a duplicate row does not list a worker twice', offer.filter((x) => x.personId === 'w2').length === 1);
check('7 sorted by last name', offer[0].person.lastName === 'Adams');
check('8 offering is repeatable: once granted they drop out (no duplicate offer)', !workersToOfferSnow(members, [...snow, { personId: 'w2', status: 'active' }]).some((x) => x.personId === 'w2'));

const items = Array.from({ length: 23 }, (_, i) => i);
check('9 history shows 10 at first with 13 more', pageOf(items, 1).shown.length === 10 && pageOf(items, 1).more === 13);
check('10 two pages show 20, 3 more', pageOf(items, 2).shown.length === 20 && pageOf(items, 2).more === 3);
check('11 enough pages shows everything and none more', pageOf(items, 3).shown.length === 23 && pageOf(items, 3).more === 0);
check('12 empty history is fine', pageOf([], 1).shown.length === 0 && pageOf([], 1).more === 0);
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
