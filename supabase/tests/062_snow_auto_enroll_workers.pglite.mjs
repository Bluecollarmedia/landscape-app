// Run: mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite && copy this file (and ./helpers/fullSchema.mjs) beside it, then:
//   node <file> <path to the repo>
// Proves update 62 on the REAL full schema + every update (PGlite, not real Supabase): switching the company to Snow Mode puts every
// active worker on the snow team with all three services, with no sign-up; someone the owner removed stays removed; a worker who joins
// while Snow Mode is on is put on the team too; nothing happens in Landscaping Mode; customers and pending people are never added.
import fs from 'node:fs';
import { buildFullSchema } from './helpers/fullSchema.mjs';

const repo = process.argv[2];
const { db, failures } = await buildFullSchema(repo);
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + String(detail).slice(0, 240)}`); };
check('0 the full schema and all updates (including 062) load', failures.length === 0, JSON.stringify(failures));
let again = true;
try { await db.exec(fs.readFileSync(`${repo}/supabase/updates/062_snow_auto_enroll_workers.sql`, 'utf8')); } catch (e) { again = false; console.log(e.message); }
check('0b update 62 can be run a second time', again);
const fails = async (sql, p) => { try { await db.query(sql, p); return { raised: false, msg: '' }; } catch (e) { return { raised: true, msg: String(e.message) }; } };
const one = async (sql, p) => (await db.query(sql, p)).rows[0];
const all = async (sql, p) => (await db.query(sql, p)).rows;

const co = (await one(`insert into public.companies (name) values ('Test Co') returning id`)).id;
const mk = async (email, name) => {
  const u = (await one(`insert into auth.users (email) values ($1) returning id`, [email])).id;
  const pid = (await one(`select id from public.people where user_id = $1`, [u]))?.id
    ?? (await one(`insert into public.people (user_id, email, first_name, last_name) values ($1, $2, $3, 'T') returning id`, [u, email, name])).id;
  return { u, pid };
};
const owner = await mk('owner@x.test', 'Owner');
const w1 = await mk('w1@x.test', 'W1');
const w2 = await mk('w2@x.test', 'W2');
const wPending = await mk('wp@x.test', 'Pending');
const cust = await mk('c@x.test', 'Cust');
await db.query(`insert into public.company_members (company_id, person_id, role, status) values ($1,$2,'owner','active'),($1,$3,'worker','active'),($1,$4,'worker','active'),($1,$5,'worker','invited'),($1,$6,'customer','active')`, [co, owner.pid, w1.pid, w2.pid, wPending.pid, cust.pid]);
const team = async () => all(`select person_id, status from public.snow_staff where company_id = $1`, [co]);
const asUser = async (u) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${u}', false); set role authenticated;`); };

check('1 in Landscaping Mode nobody is put on the snow team', (await team()).length === 0);

// the owner switches to Snow Mode
await asUser(owner.u);
let f = await fails(`update public.companies set active_mode = 'snow' where id = $1`, [co]);
await db.exec('reset role');
check('2 the owner can switch to Snow Mode', !f.raised && (await one(`select active_mode from public.companies where id = $1`, [co])).active_mode === 'snow', f.msg);
let t = await team();
check('3 both active workers are on the snow team, active, with no sign-up', t.length === 2 && t.every((x) => x.status === 'active') && t.some((x) => x.person_id === w1.pid) && t.some((x) => x.person_id === w2.pid), JSON.stringify(t));
const svc = await all(`select service from public.snow_staff_services where company_id = $1 and person_id = $2 order by service`, [co, w1.pid]);
check('4 each gets plowing, salting and shoveling', svc.map((x) => x.service).join() === 'plowing,salting,shoveling', JSON.stringify(svc));
check('5 a pending worker and a customer are not added', !t.some((x) => x.person_id === wPending.pid || x.person_id === cust.pid));
const logs = await all(`select action, services, actor_id from public.snow_access_log where company_id = $1`, [co]);
check('6 it is written in the access log as granted (by the system)', logs.length === 2 && logs.every((l) => l.action === 'granted' && l.actor_id === null), JSON.stringify(logs));

// the worker's own view
await asUser(w2.u);
const mine = (await one(`select public.get_my_snow_access() as a`)).a;
await db.exec('reset role');
check('7 the worker\'s app sees snow access with all services (what lets the toggle show)', Array.isArray(mine) && mine.length === 1 && mine[0].services.length === 3 && mine[0].landscaping_access === true, JSON.stringify(mine));
await asUser(w2.u);
const asLead = (await one(`select public.snow_has_service($1, 'plowing') as ok`, [co])).ok;
await db.exec('reset role');
check('8 and the database treats them as able to plow (so they can be made a route lead)', asLead === true);

// revoke, then switch off and on again
await asUser(owner.u);
f = await fails(`select public.snow_revoke_access($1)`, [w1.pid]);
await db.query(`update public.companies set active_mode = 'landscaping' where id = $1`, [co]);
await db.query(`update public.companies set active_mode = 'snow' where id = $1`, [co]);
await db.exec('reset role');
const w1row = await one(`select status from public.snow_staff where company_id = $1 and person_id = $2`, [co, w1.pid]);
const w1svc = await all(`select 1 from public.snow_staff_services where company_id = $1 and person_id = $2`, [co, w1.pid]);
check('9 a worker the owner removed stays removed when Snow Mode is switched off and on again', !f.raised && w1row.status === 'revoked' && w1svc.length === 0, JSON.stringify({ w1row, w1svc }) + f.msg);
await asUser(w1.u);
const w1access = (await one(`select public.get_my_snow_access() as a`)).a;
await db.exec('reset role');
check('10 and their app sees no snow access (they get the "Snow Mode is on" notice, no toggle)', Array.isArray(w1access) && w1access.length === 0, JSON.stringify(w1access));

// the owner can give access back by hand
await asUser(owner.u);
f = await fails(`select public.snow_grant_access($1, array['plowing'])`, [w1.pid]);
await db.exec('reset role');
check('11 the owner can give a removed worker access again by hand', !f.raised && (await one(`select status from public.snow_staff where person_id = $1`, [w1.pid])).status === 'active', f.msg);

// someone joins while Snow Mode is on
const w3 = await mk('w3@x.test', 'W3');
await db.query(`insert into public.company_members (company_id, person_id, role, status) values ($1, $2, 'worker', 'active')`, [co, w3.pid]);
check('12 a worker who joins while Snow Mode is on is put on the team', (await one(`select status from public.snow_staff where person_id = $1`, [w3.pid]))?.status === 'active');
const w4 = await mk('w4@x.test', 'W4');
await db.query(`insert into public.company_members (company_id, person_id, role, status) values ($1, $2, 'worker', 'invited')`, [co, w4.pid]);
await db.query(`update public.company_members set status = 'active' where person_id = $1`, [w4.pid]);
check('13 so is a worker who is approved (invited → active) while Snow Mode is on', (await one(`select status from public.snow_staff where person_id = $1`, [w4.pid]))?.status === 'active');

// back to landscaping: new workers are not added
await db.query(`update public.companies set active_mode = 'landscaping' where id = $1`, [co]);
const w5 = await mk('w5@x.test', 'W5');
await db.query(`insert into public.company_members (company_id, person_id, role, status) values ($1, $2, 'worker', 'active')`, [co, w5.pid]);
check('14 in Landscaping Mode a new worker is not added', (await one(`select 1 as x from public.snow_staff where person_id = $1`, [w5.pid])) === undefined);
await db.query(`update public.companies set active_mode = 'snow' where id = $1`, [co]);
check('15 but is added as soon as Snow Mode is switched on', (await one(`select status from public.snow_staff where person_id = $1`, [w5.pid]))?.status === 'active');

// other companies are untouched
await db.exec(`set session_replication_role = replica`);
const co2 = (await one(`insert into public.companies (name) values ('Other Co') returning id`)).id;
const o2 = await mk('o2@x.test', 'O2');
await db.query(`insert into public.company_members (company_id, person_id, role, status) values ($1, $2, 'worker', 'active')`, [co2, o2.pid]);
await db.exec(`set session_replication_role = origin`);
await db.query(`update public.companies set active_mode = 'snow' where id = $1`, [co]);
check('16 another company\'s worker is not touched by this company\'s switch', (await one(`select 1 as x from public.snow_staff where company_id = $1`, [co2])) === undefined);

const bad = results.filter((x) => !x).length;
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
