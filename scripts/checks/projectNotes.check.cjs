// Run: node scripts/checks/projectNotes.check.cjs <path to typescript package>
// The owner's private project notes, pictures and AI-sorted materials list: the list logic, the privacy, and the wiring.
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
const m = { exports: {} };
new Function('module', 'exports', ts.transpileModule(read('src/lib/materialList.ts'), { compilerOptions: { module: 'commonjs' } }).outputText)(m, m.exports);
const l = m.exports;
let bad = 0;
const check = (n, ok, detail) => { if (!ok) bad++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : ' - ' + (detail || ''))); };

const raw = { title: 'Wyndham mulch job', items: [
  { category: 'Mulch', item: '  Brown   mulch ', quantity: 12, unit: 'yards', notes: 'double shredded' },
  { category: 'Edging', item: 'Steel edging', quantity: '40', unit: 'ft', notes: '' },
  { category: '', item: 'Landscape fabric', quantity: null, unit: '', notes: '' },
  { category: 'Mulch', item: '', quantity: 3 },
  { item: 'Odd qty', quantity: 'lots' },
  'junk', null, 42,
], other_notes: ['Gate code is with the owner', '', 7] };
const list = l.normalizeMaterialList(raw);
check('1 the AI answer is cleaned: spaces tidied, empty items dropped, a missing category becomes Other, quantities are numbers or empty (never guessed)',
  list.items.length === 4 && list.items[0].item === 'Brown mulch' && list.items[1].quantity === 40 && list.items[2].category === 'Other' && list.items[2].quantity === null && list.items[3].quantity === null, JSON.stringify(list.items));
check('2 other notes are kept (non-text entries dropped); strange answers become an empty list, not an error', list.otherNotes.length === 1 && l.normalizeMaterialList('garbage').items.length === 0 && l.normalizeMaterialList(null).title === 'Materials list');
const g = l.groupByCategory(list.items);
check('3 grouped by category in the order they first appear', g.map((x) => x.category).join() === 'Mulch,Edging,Other', g.map((x) => x.category).join());
check('4 quantities read well', l.quantityText(list.items[0]) === '12 yards' && l.quantityText(list.items[2]) === '');
const html = l.materialListHtml({ list: { ...list, items: [...list.items, { category: 'Mulch', item: '<script>alert(1)</script>', quantity: 1, unit: '', notes: '' }] }, projectName: 'Wyndham 2', address: '1 Edward Dr', company: 'Brighton Lawn + Landscape', dateText: 'October 19, 2026' });
check('5 the vendor page has the project, address, groups, quantities and the company, and nothing from the notes can inject HTML', /Wyndham 2/.test(html) && /1 Edward Dr/.test(html) && /12 yards/.test(html) && /Prepared by Brighton Lawn \+ Landscape/.test(html) && !/<script>alert/.test(html) && /&lt;script&gt;/.test(html));
check('6 no prices and no customer details on the vendor page', !/\$|customer|price/i.test(html.replace(/<style[\s\S]*?<\/style>/, '')));
const stored = l.listToStored(list);
const back = l.storedToList({ title: list.title, items: stored });
check('7 a saved list keeps the other notes (as an "Other notes" group) and reads back the same', stored.some((x) => x.category === 'Other notes') && back.items.length === list.items.length + 1);
const text = l.notesAsText([{ body: 'second', createdAt: '2026-10-05T10:00:00Z' }, { body: 'first', createdAt: '2026-10-01T10:00:00Z' }]);
check('8 notes go to the AI oldest first, each with its date', text.indexOf('first') < text.indexOf('second') && /^\[Oct 1\] first/.test(text), text);

const fn = read('supabase/functions/organize-materials/index.ts');
check('9 the AI function: owner only, never invents quantities, one JSON answer, key kept in a secret',
  /eq\('role', 'owner'\)/.test(fn) && /Never invent items, brands, prices or quantities/.test(fn) && /ANTHROPIC_API_KEY/.test(fn) && /MAX_CHARS = 12000/.test(fn) && /not_allowed/.test(fn));
const sql = read('supabase/updates/057_owner_project_notes.sql');
check('10 the database keeps all three tables OWNER-ONLY and they belong to the project (tested)', /is_company_owner\(company_id\)/.test(sql) && /owner_project_notes/.test(sql) && /owner_project_photos/.test(sql) && /owner_material_lists/.test(sql) && fs.existsSync(path.join(__dirname, '../../supabase/tests/057_owner_project_notes.pglite.mjs')));
const data = read('src/data/ownerProjectNotes.ts');
check('11 sorting sends only this project\'s notes, saves the clean list, and errors are explained in words',
  /filter\(\(n\) => n\.projectId === projectId\)/.test(data) && /normalizeMaterialList\(data\.list/.test(data) && /insertRow\('owner_material_lists'/.test(data) && /isn't deployed yet/.test(data) && /AI key is missing/.test(data));
const comp = read('src/components/projects/ProjectPrivateNotes.tsx');
check('12 the screen shows only to the owner, with notes (add/edit/delete), pictures (take/choose, caption, delete) and the list (sort, open, print/share PDF, delete)',
  /if \(!isOwner\) return null;/.test(comp) && /Add Note/.test(comp) && /updateOwnerNote/.test(comp) && /pickImage\(source/.test(comp) && /updateOwnerPhotoCaption/.test(comp) && /Sort Notes into a Materials List/.test(comp) && /Print \/ Share as PDF/.test(comp) && /deleteMaterialList/.test(comp) && !/allowsEditing/.test(comp));
const quote = read('app/(owner)/document-edit.tsx');
check('13 notes are available while quoting (details and line items steps of a quote)', (quote.match(/<ProjectPrivateNotes /g) || []).length === 2 && /step === 0 && doc\.kind === 'quote'/.test(quote) && /step === 1 && doc\.kind === 'quote'/.test(quote));
const proj = read('app/(owner)/(tabs)/projects/[id].tsx');
check('14 the project has a My Notes section (More menu, owner only) holding the same notes after approval', /key: 'notes', label: 'My Notes'/.test(proj) && /item\.key !== 'notes' \|\| isProjectOwner/.test(proj) && /moreSubSection === 'notes' && isProjectOwner/.test(proj));
console.log(bad ? '\n' + bad + ' failed' : '\nall passed');
process.exit(bad ? 1 : 0);
