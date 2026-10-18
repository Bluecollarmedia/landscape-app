// Run: node scripts/checks/snowExistingFlow.check.cjs <path to typescript package>
// Checks the order of steps in src/data/snowExisting.ts against an in-memory FAKE of the two
// tables it uses. This is NOT the real database: it shows the steps and the duplicate handling
// are right, not that the live policies accept them.
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/data/snowExisting.ts'), 'utf8');

// ---- fake database ---------------------------------------------------------
let props, contacts, failContactInsert, idn;
const reset = () => { props = []; contacts = []; failContactInsert = false; idn = 0; };
reset();
const q = (table, rows) => {
  const f = { filters: [] };
  const api = {
    select: () => api,
    eq: (k, v) => { f.filters.push((r) => r[k] === v); return api; },
    is: (k, v) => { f.filters.push((r) => (r[k] ?? null) === v); return api; },
    then: (res) => res({ data: rows().filter((r) => f.filters.every((fn) => fn(r))), error: null }),
  };
  return api;
};
const supabase = {
  from: (table) => ({
    insert: (row) => ({
      select: () => ({
        single: async () => {
          const r = { id: `${table}-${++idn}`, ...row };
          if (table === 'snow_properties') props.push(r);
          return { data: r, error: null };
        },
      }),
    }),
    select: () => q(table, () => (table === 'snow_property_contacts' ? contacts : props)),
  }),
};
const addContact = async (companyId, propertyId, input) => {
  if (failContactInsert) return { ok: false, error: 'Only a customer account of this company can be linked to a contact' };
  if (contacts.some((c) => c.property_id === propertyId && c.person_id === input.personId && !c.removed_at)) return { ok: false, error: 'duplicate' };
  if (input.isPrimary && contacts.some((c) => c.property_id === propertyId && c.is_primary && !c.removed_at)) return { ok: false, error: 'two primaries' };
  contacts.push({ id: `c-${++idn}`, property_id: propertyId, person_id: input.personId, is_primary: !!input.isPrimary, name: input.name, removed_at: null });
  return { ok: true, data: {} };
};

const js = ts.transpileModule(src, { compilerOptions: { module: 'commonjs', esModuleInterop: true } }).outputText;
const m = { exports: {} };
const req = (name) => {
  if (name === '@/lib/supabase') return { supabase, isSupabaseConfigured: true };
  if (name === '@/data/snowProperties') return { addContact };
  throw new Error('unexpected import ' + name);
};
new Function('module', 'exports', 'require', js)(m, m.exports, req);
const { addCustomerPlaceToSnow } = m.exports;

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + detail}`); };
const customer = { personId: 'cust-1', firstName: 'Cy', lastName: 'Young', email: 'cy@x.test', phone: '555' };
const place = { address: '205 Kathy Lane', city: 'Lakewood', state: 'NJ', zip: '08701' };
const args = (extra = {}) => ({ companyId: 'co', customer, place, propertyName: 'Beach House', ...extra });

(async () => {
  let r = await addCustomerPlaceToSnow(args());
  check('1 new place: makes one Snow property and links the customer', r.ok && r.createdProperty && r.linkedCustomer && props.length === 1 && contacts.length === 1, JSON.stringify(r));
  check('2 the link carries the customer\'s account id, name, and is the main contact', contacts[0].person_id === 'cust-1' && contacts[0].name === 'Cy Young' && contacts[0].is_primary);
  const pid = r.propertyId;

  r = await addCustomerPlaceToSnow(args({ existingPropertyId: pid }));
  check('3 doing it again for the same customer adds nothing (no duplicate property or link)', r.ok && !r.createdProperty && !r.linkedCustomer && props.length === 1 && contacts.length === 1, JSON.stringify(r));

  r = await addCustomerPlaceToSnow(args({ existingPropertyId: pid, customer: { ...customer, personId: 'cust-2', firstName: 'Di', lastName: 'Cole' } }));
  check('4 a second customer on the same property is linked, and is not a second main contact', r.ok && r.linkedCustomer && contacts.length === 2 && contacts[1].is_primary === false, JSON.stringify(contacts));

  reset();
  failContactInsert = true;
  r = await addCustomerPlaceToSnow(args());
  check('5 if the link is refused the property still exists and its id is returned so a retry can reuse it', !r.ok && !!r.propertyId && props.length === 1 && contacts.length === 0, JSON.stringify(r));
  failContactInsert = false;
  r = await addCustomerPlaceToSnow(args({ existingPropertyId: r.propertyId }));
  check('6 the retry links without making a second property', r.ok && r.linkedCustomer && props.length === 1 && contacts.length === 1);

  reset();
  contacts.push({ id: 'old', property_id: 'p-x', person_id: 'someone', is_primary: true, removed_at: null });
  r = await addCustomerPlaceToSnow(args({ existingPropertyId: 'p-x' }));
  check('7 an existing main contact is kept; the customer is added as a regular contact', r.ok && contacts.length === 2 && contacts[1].is_primary === false);

  reset();
  contacts.push({ id: 'gone', property_id: 'p-y', person_id: 'cust-1', is_primary: false, removed_at: '2026-01-01' });
  r = await addCustomerPlaceToSnow(args({ existingPropertyId: 'p-y' }));
  check('8 a customer whose old link was removed can be linked again', r.ok && r.linkedCustomer && contacts.length === 2);

  console.log(bad ? `\n${bad} failed` : '\nall passed');
  process.exit(bad ? 1 : 0);
})();
