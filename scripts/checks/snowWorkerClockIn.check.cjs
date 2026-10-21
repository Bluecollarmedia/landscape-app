// Run: node scripts/checks/snowWorkerClockIn.check.cjs
// Every Snow worker lands on the Route page, which has "Clock in for the storm" at the top; clocking out is only in the Time Clock tab;
// both screens read the same clock fresh each time they come to the front.
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
let bad = 0;
const check = (n, ok, d = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  - ' + d}`); };

const layout = read('app/snow/worker/(tabs)/_layout.tsx');
const index = read('app/snow/worker/(tabs)/index.tsx');
const route = read('src/components/snow/routes/MyRouteScreen.tsx');
const card = read('src/components/snow/time/SnowClockInCard.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
const hook = read('src/hooks/useSnowClock.ts');
const time = read('src/components/snow/time/SnowTimeScreens.tsx');

check('1 the Route tab is first and shown to every Snow worker (no hiding it for non-leads)', /name: 'index', title: 'Route'/.test(layout) && !/hidden/.test(layout) && !/isLead/.test(layout));
check('2 the Route tab no longer sends non-leads to the Time Clock', !/Redirect/.test(index) && /MyRouteScreen/.test(index));
check('3 the Route page shows the clock-in card right under its header (and in the empty state when there is no route)', /<\/View>\s*<SnowClockInCard \/>/.test(route) && (route.match(/<SnowClockInCard \/>/g) || []).length === 2);
check('4 the card offers Clock In when allowed, and only a status line once clocked in', /Clock in for the storm/.test(card) && /Clocked in since/.test(card) && /clockInNow/.test(card));
check('5 the card has no Clock Out button (clocking out lives in the Time Clock tab only)', !/clockOut/.test(card) && !/Clock Out/.test(card.replace(/Clock out in the Time Clock tab/g, '')));
check('6 the card shows nothing when the worker cannot clock in (not on a dispatched route)', /if \(!allowed\) return null/.test(card));
check('7 the clock state is read fresh whenever either screen comes to the front', /useFocusEffect/.test(hook) && /useFocusEffect\(useCallback\(\(\) => \{ void reload\(\); \}, \[reload\]\)\)/.test(time));
check('8 the Time Clock tab still clocks in and out and lists the week', /Clock Out/.test(time) && /clockIn\(\)/.test(time) && /clockOut\(\)/.test(time) && /This week/.test(time));
check('9 both screens use the same database calls (one clock)', /clockIn/.test(hook) && /loadShifts/.test(hook) && /canClockIn/.test(hook));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
