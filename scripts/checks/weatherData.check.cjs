// Run: node scripts/checks/weatherData.check.cjs [path to typescript package]
// Brighton Weather, Phase 2: the weather data converter (supabase/functions/weather/index.ts, the pure part above its marker line).
//   Real samples: scripts/fixtures/nws/* are real NWS responses for Lakewood captured on 2026-10-26 (trimmed). They contain NO snow (it is
//   October), so snowfall maths is ALSO tested with clearly labelled SYNTHETIC blocks (invented numbers, used only inside this test, never shown
//   to anyone). These tests run the converter in Node; the Deno wrapper that fetches NWS is not run here.
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fixture = (n) => JSON.parse(read(`scripts/fixtures/nws/${n}.json`));

const src = read('supabase/functions/weather/index.ts');
const marker = src.indexOf('// ───────────────────────────── Deno edge function below');
const pure = src.slice(0, marker);
const m = { exports: {} };
new Function('module', 'exports', ts.transpileModule(pure, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText)(m, m.exports);
const { TOWNS, iconFor, parseValidTime, localDate, snowByLocalDay, normalizeAlerts, normalizeForecast } = m.exports;

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + detail}`); };
const NY = 'America/New_York';
const NOW = Date.parse('2026-10-26T20:30:00Z'); // 4:30 PM Eastern on the day the samples were captured

// ── towns ──
const keys = Object.keys(TOWNS);
check('1 exactly the eight towns, in the agreed names', JSON.stringify(keys) === JSON.stringify(['lakewood', 'jackson', 'howell', 'toms-river', 'brick', 'manchester', 'freehold', 'point-pleasant']));
check('2 every town has a verified point (4-decimal coordinates), a grid, a forecast zone and the Eastern time zone', keys.every((k) => { const t = TOWNS[k]; const dec = (n) => (String(n).split('.')[1] ?? '').length <= 4; return t.office === 'PHI' && /^NJZ\d{3}$/.test(t.zone) && t.gridX > 0 && t.gridY > 0 && dec(t.lat) && dec(t.lon) && t.lat > 39.9 && t.lat < 40.3 && t.lon < -74 && t.lon > -74.5 && t.tz === NY; }));
check('2b Point Pleasant keeps its own forecast zone (NJZ026), not the county-wide one', TOWNS['point-pleasant'].zone === 'NJZ026' && TOWNS.lakewood.zone === 'NJZ020' && TOWNS.howell.zone === 'NJZ013');

// ── pieces ──
const icons = [['Sunny', true, 'sun'], ['Clear', false, 'moon'], ['Partly Cloudy', true, 'partly'], ['Mostly Clear', false, 'moon'], ['Mostly Cloudy', true, 'cloud'], ['Light Snow', true, 'snow'], ['Chance Rain Showers', true, 'rain'], ['Patchy Fog', false, 'fog'], ['Slight Chance Thunderstorms', true, 'storm'], ['Freezing Rain', true, 'snow'], ['', true, 'cloud']];
check('3 weather words map to the right picture', icons.every(([t, d, want]) => iconFor(t, d) === want), JSON.stringify(icons.filter(([t, d, want]) => iconFor(t, d) !== want)));
const p1 = parseValidTime('2026-10-26T14:00:00+00:00/PT4H'); const p2 = parseValidTime('2026-10-26T14:00:00+00:00/P5DT22H'); const p3 = parseValidTime('2026-10-26T14:00:00+00:00/PT30M');
check('4 NWS time spans are read (PT4H, P5DT22H, PT30M); junk is refused', p1.end - p1.start === 4 * 3600000 && p2.end - p2.start === (5 * 24 + 22) * 3600000 && p3.end - p3.start === 1800000 && parseValidTime('nonsense') === null && parseValidTime('2026-10-26T14:00:00Z/PT0H') === null);
check('5 local dates follow Eastern time, including the daylight-saving change on Nov 1 2026', localDate(Date.parse('2026-11-01T03:30:00Z'), NY) === '2026-10-31' && localDate(Date.parse('2026-11-01T05:30:00Z'), NY) === '2026-11-01' && localDate(Date.parse('2026-12-10T04:59:00Z'), NY) === '2026-12-09' && localDate(Date.parse('2026-12-10T05:00:00Z'), NY) === '2026-12-10');

// ── snowfall maths: SYNTHETIC numbers, labelled ──
const day0 = Date.parse('2026-12-10T05:00:00Z'); // midnight Eastern on Dec 10 2026
const synth = [
  { validTime: '2026-12-10T05:00:00+00:00/PT6H', value: 25.4 },   // SYNTHETIC: 1.0 in over 00-06
  { validTime: '2026-12-10T11:00:00+00:00/PT6H', value: 50.8 },   // SYNTHETIC: 2.0 in over 06-12
  { validTime: '2026-12-10T17:00:00+00:00/PT12H', value: 0 },      // SYNTHETIC: a real zero over 12-24
  { validTime: '2026-12-11T05:00:00+00:00/PT6H', value: null },    // SYNTHETIC: a block with no number
  { validTime: '2026-12-11T11:00:00+00:00/PT12H', value: 12.7 },   // SYNTHETIC: 0.5 in over 06-18 only
];
let s = snowByLocalDay(synth, 'wmoUnit:mm', day0, day0 + 3 * 24 * 3600000, NY);
check('6 SYNTHETIC: blocks are added up per local day in inches (1 + 2 + 0 = 3.0)', s['2026-12-10'] === 3);
check('7 a day whose forecast has a block with no number is "unavailable" (null), never 0', s['2026-12-11'] === null, JSON.stringify(s));
check('8 a day only partly covered by blocks is "unavailable" (null)', s['2026-12-12'] === null);
const zero = snowByLocalDay([{ validTime: '2026-12-10T05:00:00+00:00/PT24H', value: 0 }], 'wmoUnit:mm', day0, day0 + 24 * 3600000, NY);
check('9 a real zero stays 0 (it is not unavailable)', zero['2026-12-10'] === 0);
check('10 unknown units or no blocks at all give null for every day', Object.values(snowByLocalDay(synth, 'wmoUnit:weird', day0, day0 + 86400000, NY)).every((v) => v === null) && Object.values(snowByLocalDay(undefined, 'wmoUnit:mm', day0, day0 + 86400000, NY)).every((v) => v === null));
s = snowByLocalDay([{ validTime: '2026-12-10T05:00:00+00:00/PT24H', value: 25.4 }], 'wmoUnit:mm', day0 + 12 * 3600000, day0 + 24 * 3600000, NY);
check('11 "today" counts only the hours still ahead (a 1 in block over 24 h leaves 0.5 in for the second half)', s['2026-12-10'] === 0.5);
check('11b centimeters convert too (2.54 cm = 1 in)', snowByLocalDay([{ validTime: '2026-12-10T05:00:00+00:00/PT24H', value: 2.54 }], 'wmoUnit:cm', day0, day0 + 86400000, NY)['2026-12-10'] === 1);

// ── real Lakewood samples ──
const forecast = fixture('lakewood-forecast'); const hourly = fixture('lakewood-hourly'); const grid = fixture('lakewood-grid');
const alertsNJ = fixture('alerts-nj'); const alertsZone = fixture('alerts-zone-empty');
const out = normalizeForecast({ townKey: 'lakewood', forecast, hourly, grid, alerts: alertsZone, now: NOW });
check('12 REAL: the answer names the town and the source', out.town === 'lakewood' && out.townName === 'Lakewood' && out.source === 'National Weather Service' && out.fetchedAt === NOW);
check('13 REAL: "now" is the hour we are in (4 PM), with a real temperature and the agency\'s own words', out.current && typeof out.current.tempF === 'number' && out.current.text === hourly.properties.periods[0].shortForecast && out.hourly[0].time === hourly.properties.periods[0].startTime, JSON.stringify(out.current));
check('14 REAL: 12 hours, in order', out.hourly.length === 12 && out.hourly.every((h, i) => i === 0 || Date.parse(h.time) > Date.parse(out.hourly[i - 1].time)));
check('15 REAL: up to 7 distinct days, today first', out.daily.length >= 5 && out.daily.length <= 7 && new Set(out.daily.map((d) => d.date)).size === out.daily.length && out.daily[0].date === '2026-10-26', JSON.stringify(out.daily.map((d) => d.date)));
check('16 REAL: highs and lows come from the day and night periods', out.daily[1].highF === forecast.properties.periods.find((p, i) => p.isDaytime && localDate(Date.parse(p.startTime), NY) === out.daily[1].date).temperature && typeof out.daily[1].lowF === 'number');
check('17 REAL: the header high/low is today\'s', out.today.highF === out.daily[0].highF && out.today.lowF === out.daily[0].lowF);
check('18 REAL: today has snowfall data covering the rest of the day, and it is a real 0 (not null)', out.daily[0].snowIn === 0, String(out.daily[0].snowIn));
const unavailable = out.daily.filter((d) => d.snowIn === null).length;
check('19 REAL: days beyond what the raw grid covers are "unavailable" (null), never 0', unavailable >= 1 && out.daily.filter((d) => d.snowIn === 0).length >= 1, JSON.stringify(out.daily.map((d) => [d.date, d.snowIn])));
check('20 REAL: no alerts in the real empty zone answer', out.alerts.length === 0);

// ── alerts ──
const feat = alertsNJ.features.map((f) => f.properties);
const early = Date.parse('2026-10-26T11:00:00Z'); // 7 AM Eastern: the advisories were still in force
const live = normalizeAlerts(alertsNJ, early);
check('21 REAL: a cancelled alert is not shown, the in-force ones are', live.length >= 1 && !live.some((a) => /cancelled/i.test(a.headline)) && feat.some((p) => p.messageType === 'Cancel'));
check('22 REAL: the agency\'s headline and name pass through untouched', live.every((a) => feat.some((p) => p.headline === a.headline && p.senderName === a.sender)) && live[0].sender === 'NWS Mount Holly NJ');
check('23 REAL: alerts that have expired are dropped', normalizeAlerts(alertsNJ, NOW).length === 0);
const mixed = { features: [{ properties: { status: 'Actual', messageType: 'Alert', severity: 'Minor', event: 'A', headline: 'a', expires: '2026-12-01T00:00:00Z' } }, { properties: { status: 'Actual', messageType: 'Alert', severity: 'Severe', event: 'B', headline: 'b', expires: '2026-12-01T00:00:00Z' } }, { properties: { status: 'Test', messageType: 'Alert', severity: 'Extreme', event: 'T', headline: 't', expires: '2026-12-01T00:00:00Z' } }] };
const sorted = normalizeAlerts(mixed, Date.parse('2026-11-30T00:00:00Z'));
check('24 SYNTHETIC: most severe first, and test alerts are dropped', sorted.map((a) => a.event).join() === 'B,A');

// ── missing data never turns into numbers ──
const empty = normalizeForecast({ townKey: 'lakewood', forecast: undefined, hourly: undefined, grid: undefined, alerts: undefined, now: NOW });
check('25 no data at all: no current, no hours, no days, no alerts, no made-up numbers', empty.current === null && empty.hourly.length === 0 && empty.daily.length === 0 && empty.alerts.length === 0 && empty.today.highF === null && empty.today.lowF === null);
const noGrid = normalizeForecast({ townKey: 'lakewood', forecast, hourly, grid: undefined, alerts: undefined, now: NOW });
check('26 forecast without the raw grid: every snowfall figure is "unavailable" (null)', noGrid.daily.length > 0 && noGrid.daily.every((d) => d.snowIn === null));
const celsius = normalizeForecast({ townKey: 'lakewood', forecast: { properties: { periods: [] } }, hourly: { properties: { periods: [{ startTime: '2026-10-26T16:00:00-04:00', endTime: '2026-10-26T17:00:00-04:00', isDaytime: true, temperature: 20, temperatureUnit: 'C', shortForecast: 'Sunny' }] } }, grid: undefined, alerts: undefined, now: NOW });
check('27 a temperature given in Celsius is converted (20 C = 68 F)', celsius.current.tempF === 68);

// ── the edge wrapper (file text only: it is not run here) ──
const wrap = src.slice(marker);
check('28 the wrapper checks the owner\'s Weather switch BEFORE any request to NWS, and answers 403 when it is off', wrap.indexOf('weatherIsOn()') > -1 && wrap.indexOf('weatherIsOn()', wrap.indexOf('serve(')) < wrap.indexOf('nws(`${grid}', wrap.indexOf('serve(')) && /json\(403, \{ error: 'disabled' \}\)/.test(wrap));
check('29 if the switch cannot be read it serves nothing (503), never data', /if \(on === null\) return json\(503/.test(wrap));
check('30 it only answers for the fixed towns, identifies itself to NWS, and falls back to the last good answer marked stale', /if \(!town\) return json\(400/.test(wrap) && /User-Agent/.test(wrap) && /stale: true/.test(wrap));
check('31 it is one self-contained file (no relative imports)', !/from '\.{1,2}\//.test(src));

// ── the app side (file text only) ──
const appTowns = [...read('src/lib/weatherTowns.ts').matchAll(/key: '([a-z-]+)', name: '([^']+)'/g)].map((x) => [x[1], x[2]]);
check('32 the app\'s town list is the same eight towns, with the same keys and names, as the data function', JSON.stringify(appTowns.map((x) => x[0])) === JSON.stringify(keys) && appTowns.every(([k, n]) => TOWNS[k].name === n), JSON.stringify(appTowns));
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const weatherFiles = [...walk('app/weather'), 'src/data/weather.ts', 'src/hooks/useWeather.ts', ...walk('src/components/weather')].filter((f) => /\.(ts|tsx)$/.test(f));
check('33 the Weather screens never talk to NWS or any weather provider themselves: only the data function', weatherFiles.every((f) => !/api\.weather\.gov|weatherapi|open-meteo|visualcrossing|weatherkit/i.test(read(f))) && /functions\.invoke\('weather'/.test(read('src/data/weather.ts')));
check('34 no device-location permission is requested anywhere in the Weather screens', weatherFiles.every((f) => !/expo-location|requestForegroundPermissions|geolocation/i.test(read(f))));
check('35 a missing snowfall figure is worded as "unavailable", and the screen keeps "none" for a real zero only', /snowKind\(d\.snowIn\)/.test(read('app/weather/index.tsx')) && /k === 'unavailable'\) return \{ text: t\('Snow: unavailable'\)/.test(read('app/weather/index.tsx')) && /k === 'none'\) return \{ text: t\('Snow: none'\)/.test(read('app/weather/index.tsx')));
check('36 the Sign In buttons open the app\'s existing welcome screen (nothing is redrawn)', (read('app/weather/index.tsx').match(/router\.push\('\/\(auth\)\/welcome' as any\)/g) ?? []).length === 1 && /router\.push\('\/\(auth\)\/welcome' as any\)/.test(read('app/weather/account.tsx')));
check('37 the Weather area re-asks the owner\'s switch every 60 seconds while it is open', /setInterval\(\(\) => \{ void weatherSwitch\.refresh\(\); \}, 60_000\)/.test(read('app/weather/_layout.tsx')));
check('38 a refusal from the data function ("disabled") makes the app re-ask the switch at once', /reason === 'disabled'/.test(read('src/hooks/useWeather.ts')) && /weatherSwitch\.refresh\(\)/.test(read('src/hooks/useWeather.ts')));
check('39 the owner\'s on/off row asks before turning Weather on or off', /confirmAction\('Turn on Brighton Weather\?'/.test(read('src/hooks/usePublicWeatherRow.ts')) && /confirmAction\('Turn off Brighton Weather\?'/.test(read('src/hooks/usePublicWeatherRow.ts')));

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
