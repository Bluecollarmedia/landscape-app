// Run: node scripts/checks/inviteSignupNoSecondEmail.check.cjs
// Signing up from a private invite link: no second "confirm your email" message (the link itself is the proof), the person is signed in
// straight away, only a valid link can make such a login, and the invite link can open the app (universal links).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  - ' + detail}`); };

const fn = read('supabase/functions/invite-signup/index.ts');
const lib = read('src/lib/inviteSignup.ts');
const auth = read('src/providers/AuthProvider.tsx');
const app = JSON.parse(read('app.json'));

check('1 the function makes the login already confirmed', /email_confirm: true/.test(fn));
check('2 the function refuses unless the link is valid right now (not used, cancelled or expired)', /invite_lookup/.test(fn) && /if \(!look\?\.valid\) return reply/.test(fn));
check('3 the invite token reaches the sign-up trigger, which attaches the login and uses the link up', /invite_token: token/.test(fn));
check('4 a login that did not get attached to its record is removed (nothing is left dangling)', /deleteUser\(made\.user\.id\)/.test(fn) && /reason !== 'used'/.test(fn));
check('5 the function never makes an account for anything but an invite (no valid link, no account)', fn.indexOf('invite_lookup') > -1 && fn.indexOf('invite_lookup') < fn.indexOf('createUser'));
check('6 the app signs the person in right after, and only for invite sign-ups (company sign-ups keep the normal email confirmation)',
  /intent\?\.inviteToken && !intent\.company/.test(auth) && /createInvitedLogin\(/.test(auth) && /signInWithPassword\(\{ email, password \}\)/.test(auth) && /needsEmailConfirmation: false/.test(auth));
check('7 if the function is not there, sign-up falls back to the normal way instead of failing', /'unavailable'/.test(lib) && /made !== 'unavailable'/.test(auth) && /status === 404/.test(lib));
check('8 the reasons are plain sentences (used, expired, invalid, email already exists)', ['used', 'expired', 'invalid', 'email_exists'].every((k) => new RegExp(k + ':').test(lib)));
const domains = (app.expo && app.expo.ios && app.expo.ios.associatedDomains) || [];
check('9 the iPhone app claims the website addresses the invite links use, so tapping a link can open the app', domains.includes('applinks:brighton-app.netlify.app') && domains.includes('applinks:app.brightonlawn.com'), JSON.stringify(domains));
check('10 the website serves Apple\'s link file as JSON', /apple-app-site-association/.test(read('public/_headers')) && /application\/json/.test(read('public/_headers')));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
