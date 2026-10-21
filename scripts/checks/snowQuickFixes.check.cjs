// Run: node scripts/checks/snowQuickFixes.check.cjs
// Guards three Snow screen fixes found on a real phone.
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + detail}`); };

const act = read('app/(owner)/snow-activity.tsx');
check('1 the Snow Activity filter chips wrap onto more lines (no sideways scrolling that cut them off)', !/<ScrollView horizontal[^>]*styles\.filterBar/.test(act) && /filterBar: \{[^}]*flexWrap: 'wrap'/.test(act));
const settings = read('src/components/snow/settings/SnowSettingsScreen.tsx');
check('2 "Your profile and photo" stays inside Snow Mode', /router\.push\('\/snow\/owner\/edit-profile'/.test(settings) && !/router\.push\('\/\(owner\)\/edit-profile'/.test(settings));
check('3 that screen exists and is registered', fs.existsSync(path.join(__dirname, '../../app/snow/owner/edit-profile.tsx')) && /edit-profile/.test(read('app/snow/owner/_layout.tsx')));
const team = read('app/(owner)/(tabs)/more/snow-team.tsx');
check('4 giving a landscaping worker Snow access has a Save button', /title="Save Snow access"/.test(team));
check('5 a green "Saved" note confirms Snow access was given or changed', /flashSaved\(`Saved\. \$\{w\.person/.test(team) && /Snow services were updated/.test(team) && /tone="success"/.test(team));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
