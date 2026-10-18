// Run: node scripts/checks/snowServices.check.cjs <path to typescript package>
// Logic checks for multi-service storms in the app (src/lib/snowServices.ts).
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/lib/snowServices.ts'), 'utf8');
const m = { exports: {} };
new Function('module', 'exports', ts.transpileModule(src, { compilerOptions: { module: 'commonjs' } }).outputText)(m, m.exports);
const { stormServices, servicesLabel, toggleService, routeServiceChoice, removableServices, routesPerService, defaultStormNameFor } = m.exports;

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + detail}`); };
const L = { plowing: 'Plowing', shoveling: 'Shoveling', salting: 'Salting' };
const label = (s) => L[s];

check('1 an old storm (no list) is treated as its single service', stormServices({ service: 'plowing' }).join() === 'plowing');
check('2 a storm with an empty list falls back to the single service', stormServices({ service: 'salting', services: [] }).join() === 'salting');
check('3 a multi-service storm uses its list in order', stormServices({ service: 'plowing', services: ['plowing', 'shoveling'] }).join() === 'plowing,shoveling');

check('4 label for one service', servicesLabel(['plowing'], label) === 'Plowing');
check('5 label for two services', servicesLabel(['plowing', 'shoveling'], label) === 'Plowing + Shoveling');
check('6 label for three services', servicesLabel(['plowing', 'shoveling', 'salting'], label) === 'Plowing, Shoveling + Salting');
check('7 label for none is empty', servicesLabel([], label) === '');

check('8 toggling adds at the end and removes again', toggleService(['plowing'], 'salting').join() === 'plowing,salting' && toggleService(['plowing', 'salting'], 'plowing').join() === 'salting');

check('9 one-service storm: the route\'s service is decided, no question asked', (() => { const c = routeServiceChoice(['shoveling']); return !c.needsPick && c.service === 'shoveling'; })());
check('10 several services: the owner must choose', routeServiceChoice(['plowing', 'shoveling']).needsPick === true);
check('11 a chosen service the storm has is accepted', routeServiceChoice(['plowing', 'shoveling'], 'shoveling').service === 'shoveling');
check('12 a chosen service the storm lacks is refused', !!routeServiceChoice(['plowing', 'shoveling'], 'salting').error);
check('13 a storm with no services is an error, not a silent default', !!routeServiceChoice([]).error);

check('14 only services without routes can be removed', removableServices(['plowing', 'shoveling', 'salting'], ['plowing']).join() === 'shoveling,salting');
const counts = routesPerService(['plowing', 'shoveling'], [{ service: 'plowing' }, { service: 'plowing' }, { service: 'shoveling' }]);
check('15 routes are counted per service', counts.plowing === 2 && counts.shoveling === 1 && counts.salting === 0);

const day = new Date('2026-01-12T12:00:00');
check('16 default name for one service matches the old style', defaultStormNameFor(['plowing'], label, day) === 'Jan 12 Plowing' && defaultStormNameFor(['shoveling'], label, day) === 'Jan 12 Sidewalks');
check('17 default name for several services', defaultStormNameFor(['plowing', 'shoveling'], label, day) === 'Jan 12 Storm');
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
