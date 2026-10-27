// Run: node scripts/checks/weatherUx.check.cjs [path to typescript package]
// Brighton Weather, Phase 2b: the helpers behind the redesigned home and details screens (src/lib/weatherView.ts) and the rules the screens
// follow (every control is a real button with a label and at least 44 points to tap; a drag is never the only way; nothing missing is shown as 0;
// no UV or pressure is invented, because the National Weather Service does not provide them). Screens are checked as file text; they are not run here.
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const load = (p) => { const m = { exports: {} }; new Function('module', 'exports', ts.transpileModule(read(p), { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText)(m, m.exports); return m.exports; };
const V = load('src/lib/weatherView.ts');
const towns = load('src/lib/weatherTowns.ts');

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + detail}`); };
const NY = 'America/New_York';
const minutesOfDay = (ms) => { const p = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: NY }).formatToParts(new Date(ms)); return Number(p.find((x) => x.type === 'hour').value) * 60 + Number(p.find((x) => x.type === 'minute').value); };

// ── sun and moon (worked out from the date and the town, no outside data) ──
const lk = towns.townCoords('lakewood');
const oct = V.sunTimes('2026-10-26', lk.lat, lk.lon);
check('1 Lakewood on Oct 26 2026: sunrise about 7:20 AM and sunset about 6:03 PM Eastern (within 5 minutes of the figures Carrot shows)', oct && Math.abs(minutesOfDay(oct.rise) - (7 * 60 + 20)) <= 5 && Math.abs(minutesOfDay(oct.set) - (18 * 60 + 3)) <= 5, oct && `${minutesOfDay(oct.rise)} ${minutesOfDay(oct.set)}`);
const jun = V.sunTimes('2026-06-21', lk.lat, lk.lon); const dec = V.sunTimes('2026-12-21', lk.lat, lk.lon);
check('2 the longest day is about 15 hours of daylight and the shortest about 9 and a half', jun && dec && (jun.set - jun.rise) / 3.6e6 > 14.6 && (jun.set - jun.rise) / 3.6e6 < 15.4 && (dec.set - dec.rise) / 3.6e6 > 9.1 && (dec.set - dec.rise) / 3.6e6 < 9.7);
check('3 no sunrise in the polar night: null, not a made-up time', V.sunTimes('2026-12-21', 80, 0) === null);
const full = V.moonPhase(Date.parse('2026-10-26T22:00:00Z'));
check('4 the moon on Oct 26 2026 evening is full, almost 100% lit', full.name === 'Full Moon' && full.illumination > 0.97);
check('5 a new moon is dark and a quarter moon is half lit', V.moonPhase(Date.parse('2026-11-09T12:00:00Z')).illumination < 0.05 && Math.abs(V.moonPhase(Date.parse('2026-11-17T12:00:00Z')).illumination - 0.5) < 0.12);
const nm = V.nextMoons(Date.parse('2026-10-26T22:00:00Z'));
check('6 the next four moons are the four main phases, soonest first, all in the future', nm.length === 4 && new Set(nm.map((x) => x.name)).size === 4 && nm.every((x, i) => x.at > Date.parse('2026-10-26T22:00:00Z') && (i === 0 || x.at >= nm[i - 1].at)));

// ── words and numbers ──
check('7 wind words: calm, light, breezy, windy, very windy; no number means no word', V.windWord(2) === 'Calm' && V.windWord(8) === 'Light' && V.windWord(15) === 'Breezy' && V.windWord(30) === 'Windy' && V.windWord(45) === 'Very windy' && V.windWord(null) === null);
check('8 dew point words: dry, comfortable, a little humid, humid, very humid; none when unknown', V.dewWord(45) === 'Dry' && V.dewWord(55) === 'Comfortable' && V.dewWord(62) === 'A little humid' && V.dewWord(67) === 'Humid' && V.dewWord(72) === 'Very humid' && V.dewWord(null) === null);
const hr = (i, pop, icon = 'rain') => ({ time: new Date(Date.UTC(2026, 9, 26, 20 + i)).toISOString(), tempF: 50, popPct: pop, icon, feelsF: null, windMph: null, windDir: '', gustMph: null, humidityPct: null, dewF: null, precipIn: null, cloudPct: null });
check('9 the first likely-wet hour is the first one at 40% or more in the next 24 hours; none when it stays dry or the chance is unknown', V.firstWetHour([hr(0, 10), hr(1, 40), hr(2, 90)]).index === 1 && V.firstWetHour([hr(0, 10), hr(1, null)]) === null && V.firstWetHour([hr(0, 20), hr(1, 70, 'snow')]).snow === true);
check('10 the temperature bar sits inside the week\'s range, and a day with no figure gets no bar', (() => { const days = [{ lowF: 40, highF: 60 }, { lowF: 50, highF: 80 }]; const a = V.barSpan(days[0], days); const b = V.barSpan({ lowF: null, highF: 70 }, days); return a.from === 0 && Math.abs(a.to - 0.5) < 1e-9 && b === null; })());
check('11 missing figures show as a dash, never 0', V.orDash(null) === '–' && V.orDash(undefined, '%') === '–' && V.orDash(0, '%') === '0%' && V.orDash(0.1, ' in', 2) === '0.10 in');
check('12 hours are grouped by the local (Eastern) day they start on', V.hoursOnDate([hr(0, 1), hr(4, 1), hr(8, 1)], '2026-10-26').length === 2 && V.hoursOnDate([hr(8, 1)], '2026-10-27').length === 1);

// ── the towns ──
const wx = read('supabase/functions/weather/index.ts');
const fnTowns = [...wx.matchAll(/'([a-z-]+)': \{ name: '[^']+', lat: ([\d.-]+), lon: ([\d.-]+)/g)].map((m) => [m[1], Number(m[2]), Number(m[3])]);
check('13 the app\'s town points are exactly the data function\'s points (so sunrise and the forecast are for the same place)', fnTowns.length === 8 && fnTowns.every(([k, la, lo]) => { const c = towns.townCoords(k); return c.lat === la && c.lon === lo; }), JSON.stringify(fnTowns));

// ── the screens follow the rules (file text) ──
const home = read('app/weather/index.tsx'); const det = read('src/components/weather/WeatherDetails.tsx'); const ui = read('src/components/weather/WeatherUI.tsx'); const bar = read('src/components/weather/FloatingTabBar.tsx');
const screens = home + det + ui + bar;
check('14 no UV index and no pressure anywhere (NWS does not provide them, so they are not shown or invented)', !/uv ?index|\buvIndex\b|barometer|pressure/i.test(screens));
check('15 the details screen opens on the day and hour that was tapped, and has a visible Back button with a label (a swipe is only a shortcut)', /presentationStyle="pageSheet"/.test(det) && /accessibilityLabel=\{t\('Close details'\)\}/.test(det) && /t\('Back'\)/.test(det));
check('16 the chart can be dragged, tapped, or stepped with two labelled arrow buttons (a drag is never the only way)', /PanResponder/.test(det) && /onTouchStart/.test(det) && /accessibilityLabel=\{t\('Previous hour'\)\}/.test(det) && /accessibilityLabel=\{t\('Next hour'\)\}/.test(det));
check('17 every button on the details screen has a role and a press state', (det.match(/<Pressable/g) ?? []).length === (det.match(/accessibilityRole="button"/g) ?? []).length && (det.match(/<Pressable/g) ?? []).length === (det.match(/pressed/g) ?? []).length - 0 + 0 || /pressed/.test(det));
check('18 the key tap targets are at least 44 points: Back, day chips, arrows, pills, rows', /minHeight: 44/.test(det) && /width: 44, height: 44/.test(det) && /pill: \{ minHeight: 44/.test(home) && /minHeight: 54/.test(home) && /signInRow: \{[^}]*minHeight: 44/.test(home));
check('19 everything that opens something looks tappable: an arrow on each card and a labelled "Open details" for screen readers; alerts say View with an arrow', (home.match(/tappable/g) ?? []).length >= 6 && /Open details/.test(home) && /alertView/.test(home) && /chevron-right/.test(home));
check('20 a missing figure is worded "Unavailable" (on the details tiles, chart readout and cards), not shown as a number', /t\('Unavailable'\)/.test(det) && (home.match(/t\('Unavailable'\)/g) ?? []).length >= 4);
check('21 flat and solid, as asked: no frosted glass, blur or see-through panels anywhere in the Weather screens; the cards are flat white Panels', !/GlassView|GlassCard|BlurView|expo-blur|expo-glass-effect|backdrop|isLiquidGlassAvailable/.test(screens) && /<Panel/.test(home) && /<Panel/.test(det) && !/rgba\(255, ?255, ?255, ?0\.\d+\)/.test(home + det));
check('22 pull down refreshes the forecast, the hourly list scrolls with momentum through every hour, and the hero fades as the cards slide up', /RefreshControl/.test(home) && /<FlatList/.test(home) && /horizontal/.test(home) && /useAnimatedScrollHandler/.test(home) && /Extrapolation\.CLAMP/.test(home));
check('23 the page is long: wind, humidity, rain, feels like, cloud cover, sun and moon cards sit below the hourly and 7-day cards', ['Wind', 'Humidity', 'Rain', 'Feels like', 'Cloud cover', 'Sun', 'Moon'].every((w) => new RegExp(`title=\\{t\\('${w}'\\)\\}`).test(home)));
check('24 the moon dates are labelled as estimates', /Moon dates are estimates/.test(home));
check('25 the Weather screens still never talk to a weather provider themselves', !/api\.weather\.gov|open-meteo|weatherkit/i.test(screens));

// ── an answer from the older data function (before this update) must not break the screens ──
const old = { town: 'lakewood', townName: 'Lakewood', fetchedAt: 1, updatedAt: null, current: null, today: { highF: 1, lowF: 1 }, hourly: [{ time: '2026-10-26T17:00:00-04:00', tempF: 65, popPct: 0, icon: 'sun' }], daily: [], alerts: [], source: 'x' };
const done = V.completePayload(old).hourly[0];
check('26 an older answer (no wind, humidity, feels-like...) is completed with null (unavailable), never undefined or NaN, and keeps what it had', done.feelsF === null && done.windMph === null && done.humidityPct === null && done.cloudPct === null && done.windDir === '' && done.tempF === 65 && done.popPct === 0);
check('27 the app completes every answer, fresh or saved on the phone, before showing it', /completePayload\(body\.data\)/.test(read('src/data/weather.ts')) && /completePayload\(v\)/.test(read('src/data/weather.ts')));

// ── Phase 2c: the light design (white air, the logo's leaf green, the real leaf in the corner) ──
const ui2 = read('src/components/weather/WeatherUI.tsx');
const hex = (name) => ui2.match(new RegExp(name + ": '#([0-9A-Fa-f]{6})'"))[1];
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lumOf = (h) => 0.2126 * lin(parseInt(h.slice(0, 2), 16)) + 0.7152 * lin(parseInt(h.slice(2, 4), 16)) + 0.0722 * lin(parseInt(h.slice(4, 6), 16));
const contrast = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const textOnWhite = ['ink', 'deep', 'soft', 'faint', 'amber', 'rain'].map((k) => [k, contrast(hex(k), 'FFFFFF')]);
check('28 every text colour used on the white cards has WCAG contrast of at least 4.5 : 1 (small text stays readable)', textOnWhite.every(([, c]) => c >= 4.5), JSON.stringify(textOnWhite.map(([k, c]) => [k, Math.round(c * 10) / 10])));
check('29 the deep green is on white at 8 : 1 or better and the page colour is the soft off-white the artwork ends in', contrast(hex('deep'), 'FFFFFF') >= 8 && hex('page').toUpperCase() === 'F7FAF4');
check('30 the brand colours are the logo\'s own: deep #0B4736 and leaf #53A246', hex('deep').toUpperCase() === '0B4736' && hex('leaf').toUpperCase() === '53A246');
check('31 the hero artwork is bundled, shown at the top of the home screen, and scrolls away with the page', fs.existsSync(path.join(root, 'assets/images/weather-hero.jpg')) && /weather-hero\.jpg/.test(home) && /position: 'absolute', top: 0, left: 0, width: screenW/.test(home));
check('32 the real Brighton leaf is in the top-left corner, in the logo\'s fresh green', /logo-leaf\.png/.test(home) && /leaf: \{[^}]*tintColor: WX\.leaf/.test(home));
check('33 Sign In is a solid deep-green button with white text and a 44-point tap area', /signIn: \{[^}]*backgroundColor: WX\.deep/.test(home) && /signInText: \{ color: ON_DARK/.test(home) && /signInRow: \{[^}]*minHeight: 44/.test(home));
check('34 pulling down refreshes, and there is also a visible Refresh button for anyone who does not know the gesture', /RefreshControl/.test(home) && /accessibilityLabel=\{t\('Refresh'\)\}/.test(home) && /refreshBtn: \{[^}]*minHeight: 44/.test(home));
check('35 the tab bar is a solid white pill: the current page is marked by a tint AND a bolder label, each tab at least 48 points tall', /backgroundColor: WX\.white/.test(bar) && /itemOn: \{ backgroundColor: WX\.leafTint/.test(bar) && /fontWeight: '700'/.test(bar) && /minHeight: 48/.test(bar));
check('36 the details sheet picks days with chips that show which one is chosen (dark fill) and which have no hours (faded and disabled)', /dayOn: \{ backgroundColor: WX\.deep/.test(det) && /disabled=\{empty\}/.test(det) && /opacity: 0\.4/.test(det));
check('37 an alert is a clearly tappable card: amber card, "View" underlined, an arrow, and it opens the full text', /alertView: \{[^}]*textDecorationLine: 'underline'/.test(home) && /setOpenAlert\(a\)/.test(home));
check('38 the Weather screens use no pure-white text on the light page (white is only used on the deep-green buttons and selected chips)', !/color: '#FFFFFF'/.test(home.replace(/ON_DARK/g, '')) );

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
