// Run: node scripts/checks/navigation.check.cjs
// Guards two navigation bugs found on a real phone:
//  1) Back from Privacy/Terms/Support went to the Dashboard (the root layout rebuilt the navigator for public pages).
//  2) Tapping Properties or Snow team in Snow settings crashed (they pushed a second copy of the tab bar).
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + detail}`); };

const layout = read('app/_layout.tsx');
check('1 the root layout never returns a bare <Slot /> for public pages (that rebuilt the navigator)', !/if \(isPublicPage\) \{\s*return <Slot \/>;/.test(layout));
check('2 the same tree is returned for public and normal pages: <Slot /> then optional overlays (the worker mode toggle, the welcome)', /<>\s*<Slot \/>\s*\{isPublicPage \? null : <WorkerModeToggle \/>\}\s*\{isPublicPage \? null : <SignInWelcome \/>\}\s*<\/>/.test(layout));
check('3 the splash still shows for normal pages while loading, but not for public pages', /!isPublicPage && \(isLoading \|\| !splashDone\)/.test(layout));
const settings = read('src/components/snow/settings/SnowSettingsScreen.tsx');
check('4 Snow settings opens Properties and Snow team as their own screens (no hopping to the tab bar)', /router\.push\('\/snow\/owner\/properties-list'/.test(settings) && /router\.push\('\/snow\/owner\/team-list'/.test(settings) && !/router\.(push|navigate)\('\/snow\/owner\/(properties|team)'/.test(settings));
check('4b those two screens exist and are registered in the Snow owner stack', fs.existsSync(path.join(__dirname, '../../app/snow/owner/properties-list.tsx')) && fs.existsSync(path.join(__dirname, '../../app/snow/owner/team-list.tsx')) && /properties-list/.test(read('app/snow/owner/_layout.tsx')) && /team-list/.test(read('app/snow/owner/_layout.tsx')));
check('4c profile photos no longer use the built-in crop screen', !/allowsEditing: true/.test(read('src/components/account/EditProfileScreen.tsx')) && !/allowsEditing: true/.test(read('app/(auth)/join-team.tsx')));

// No screen outside the tabs may push to a tab route of the same shell.
const tabsOf = (shell) => fs.readdirSync(path.join(__dirname, '../..', `app/snow/${shell}/(tabs)`)).filter((f) => f.endsWith('.tsx') && !f.startsWith('_')).map((f) => f.replace('.tsx', ''));
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'node_modules') walk(p, out); } else if (/\.tsx?$/.test(f.name)) out.push(p);
  }
  return out;
}
const files = [...walk(path.join(__dirname, '../../app')), ...walk(path.join(__dirname, '../../src'))];
const offenders = [];
for (const shell of ['owner', 'worker', 'customer']) {
  let names; try { names = tabsOf(shell); } catch { continue; }
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    for (const n of names) {
      if (n === 'index') continue;
      if (new RegExp(`router\\.push\\(['"\`]/snow/${shell}/${n}['"\`]`).test(t)) offenders.push(`${path.relative(path.join(__dirname, '../..'), f)} -> /snow/${shell}/${n}`);
    }
  }
}
check('5 nothing pushes to a Snow tab route (use navigate)', offenders.length === 0, offenders.join('; '));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
