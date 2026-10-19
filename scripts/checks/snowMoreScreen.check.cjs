// Run: node scripts/checks/snowMoreScreen.check.cjs
// Snow Mode More screen: bundled header, every section/row kept, destinations and actions intact, no placeholder card.
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
const src = read('app/snow/owner/(tabs)/more.tsx');
const notify = read('src/components/snow/notifications/SnowNotifySettings.tsx');
const modeSrc = read('src/components/snow/ModeSwitchRow.tsx');
let bad = 0;
const check = (name, ok) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const has = (s) => src.includes(s);

check('1 header is the bundled local image and the file exists', has("require('../../../../assets/images/snow-mode-more-header.png')") && fs.existsSync(path.join(__dirname, '../../assets/images/snow-mode-more-header.png')));
check('2 header keeps its aspect ratio (width / ratio height)', has('941 / 500') && has('width / HEADER_RATIO'));
check('3 old placeholder card is gone', !/SnowPlaceholder/.test(src) && !/being designed/i.test(src));
check('4 all section titles', ['Settings', 'Records', 'Alerts', 'Mode', 'Legal & Support', 'Account'].every((t) => has(`title="${t}"`)));
check('5 settings/records rows, titles and subtitles', [
  'Snow settings', 'Stop rule, alerts, team and customers', 'Activity log', 'Everything that happened, by storm, route and person',
  'Snow hours', 'Who clocked in this week, and fix a missed clock-out', 'Photo review', 'Approve photos and send updates to customers',
].every(has));
check('6 destinations unchanged', ['/snow/owner/settings', '/snow/owner/activity', '/snow/owner/hours', '/snow/owner/review'].every((r) => has(`router.push('${r}')`)));
check('7 legal rows', has('Privacy Policy') && has('Terms of Use') && has('Help & Support') && has('/legal/privacy') && has('/legal/terms') && has('/legal/support'));
check('8 sign out and delete account kept', has('title="Sign Out"') && has('onPress={signOut}') && has('<DeleteAccountRow />'));
check('9 alerts use the existing toggle (persistence untouched) with its explanation', has('<OwnerStopAlertsToggle companyId={db.companyId} bare />') && /Alert me when a stop is finished/.test(notify) && /Just for you\. Stops are still recorded on the dashboard and activity log when this is off\./.test(notify));
check('10 mode switch uses the existing logic', has('useModeSwitch()') && /export function useModeSwitch/.test(modeSrc) && /Switch to Landscaping Mode|Landscaping/.test(modeSrc));
check('11 bottom padding clears the tab bar', has('useTabBarClearance()') && has('paddingBottom: tabBarClearance'));
check('12 rows have accessibility labels', has('accessibilityRole="button"') && has('accessibilityLabel={subtitle'));
check('13 no new dependencies', !/expo-linear-gradient|expo-blur/.test(src));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
