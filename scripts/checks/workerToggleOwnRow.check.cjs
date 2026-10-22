// Run: node scripts/checks/workerToggleOwnRow.check.cjs
// The worker's Snow / Landscaping switch must never cover anything: it has its own strip under the status bar, and every screen's top
// edge starts below that strip (so a banner, a name or a profile photo is never underneath it).
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + detail}`); };

const toggle = read('src/components/snow/WorkerModeToggle.tsx');
const layout = read('app/_layout.tsx');

check('1 the toggle names the strip it needs (its height plus a little air)', /export const WORKER_TOGGLE_BAND = HEIGHT \+ 8/.test(toggle));
check('2 the toggle sits at the top of that strip (just under the status bar)', /top: insets\.top \+ 4/.test(toggle));
check('3 while the toggle shows, every screen\'s top inset grows by the strip', /SafeAreaInsetsContext\.Provider value=\{showToggle \? \{ \.\.\.insets, top: insets\.top \+ WORKER_TOGGLE_BAND \} : insets\}/.test(layout));
check('4 the strip is reserved only when the toggle is actually shown (same condition), never on public pages', /const showToggle = !isPublicPage && isAuthenticated && appState === 'active' && canToggle/.test(layout));
check('5 the toggle itself is drawn OUTSIDE the shifted area, so it keeps the real top edge', /<\/SafeAreaInsetsContext\.Provider>\s*\n\s*\{isPublicPage \? null : <WorkerModeToggle \/>\}/.test(layout));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
