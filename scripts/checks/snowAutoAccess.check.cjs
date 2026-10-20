// Run: node scripts/checks/snowAutoAccess.check.cjs <path to typescript package>
// Snow Mode for every worker with no sign-up: the toggle rules, the routing, and the wiring (the database part is in the 062 test).
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
const load = (rel) => { const m = { exports: {} }; new Function('module', 'exports', 'require', ts.transpileModule(read(rel), { compilerOptions: { module: 'commonjs' } }).outputText)(m, m.exports, () => ({})); return m.exports; };
const mc = load('src/lib/modeChoice.ts');
let bad = 0;
const check = (n, ok, detail) => { if (!ok) bad++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : ' - ' + (detail || ''))); };

const both = { snow: true, landscaping: true };
check('1 the toggle shows only for a worker with both modes while the owner has Snow Mode on',
  mc.canToggleMode('worker', 'snow', both) === true && mc.canToggleMode('worker', 'landscaping', both) === false && mc.canToggleMode('owner', 'snow', both) === false
  && mc.canToggleMode('customer', 'snow', both) === false && mc.canToggleMode('worker', 'snow', { snow: false, landscaping: true }) === false && mc.canToggleMode('worker', 'snow', { snow: true, landscaping: false }) === false);
check('2 everyone starts in Snow Mode; a saved choice only counts for the same Snow Mode switch',
  mc.resolveChoice(null, 't1') === 'snow' && mc.resolveChoice({ at: 't1', choice: 'landscaping' }, 't1') === 'landscaping' && mc.resolveChoice({ at: 't1', choice: 'landscaping' }, 't2') === 'snow'
  && mc.resolveChoice({ at: 't1', choice: 'nonsense' }, 't1') === 'snow' && mc.resolveChoice({ at: '', choice: 'landscaping' }, undefined) === 'landscaping');

// the routing, with the real shellFor from the hook file (its imports stubbed)
const src = read('src/hooks/useModeAccess.ts').replace(/^import .*$/gm, '');
const m2 = { exports: {} };
new Function('module', 'exports', 'db', 'useDb', 'updateRow', 'supabase', 'isSupabaseConfigured', 'useCallback', 'useEffect', 'useState', 'canToggleMode', 'useWorkerModeChoice',
  ts.transpileModule(src, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText)(m2, m2.exports, {}, () => {}, () => {}, {}, false, (f) => f, () => {}, () => [], mc.canToggleMode, () => ({}));
const { shellFor } = m2.exports;
check('3 a worker with snow access goes to Snow Mode when the owner turns it on (no sign-up), and back to landscaping when they use the toggle',
  shellFor('worker', 'snow', both, 'snow') === 'snow' && shellFor('worker', 'snow', both, 'landscaping') === 'landscaping' && shellFor('worker', 'landscaping', both, 'snow') === 'landscaping');
check('4 a worker the owner removed from snow (no snow access) gets the "Snow Mode is on" screen and no way in', shellFor('worker', 'snow', { snow: false, landscaping: true }, 'snow') === 'snow_notice' && shellFor('worker', 'snow', { snow: false, landscaping: true }, 'landscaping') === 'snow_notice');
check('5 owners, admins and customers are unchanged', shellFor('owner', 'snow', both) === 'snow' && shellFor('owner', 'landscaping', both) === 'landscaping' && shellFor('customer', 'snow', both) === 'landscaping' && shellFor('worker', 'snow', { snow: true, landscaping: false }, 'landscaping') === 'snow');

const layout = read('app/_layout.tsx');
const tog = read('src/components/snow/WorkerModeToggle.tsx');
check('6 the glass toggle sits at the top right of every screen (mounted once in the root layout), liquid glass on iOS 26 and a frosted pill elsewhere',
  /<WorkerModeToggle \/>/.test(layout) && /GlassView glassEffectStyle="regular"/.test(tog) && /position: 'absolute'/.test(tog) && /right: spacing\.md/.test(tog) && /canToggle/.test(tog));
const sql = read('supabase/updates/062_snow_auto_enroll_workers.sql');
check('7 the database update puts workers on the team when Snow Mode is switched on, never re-adds a removed worker, and has a test',
  /companies_snow_enroll/.test(sql) && /company_members_snow_enroll/.test(sql) && /already on the team, or removed on purpose/.test(sql) && fs.existsSync(path.join(__dirname, '../../supabase/tests/062_snow_auto_enroll_workers.pglite.mjs')));
console.log(bad ? '\n' + bad + ' failed' : '\nall passed');
process.exit(bad ? 1 : 0);
