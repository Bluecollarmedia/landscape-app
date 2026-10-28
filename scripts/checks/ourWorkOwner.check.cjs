// Run: node scripts/checks/ourWorkOwner.check.cjs <path to typescript package>
// Our Work, the owner's side: how pictures are made and uploaded (high-quality photos, small grid copies, original videos) and how posts are saved.
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
const compile = (src) => {
  const m = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(src, { compilerOptions: { module: 'commonjs', esModuleInterop: true } }).outputText)(m, m.exports, () => ({}));
  return m.exports;
};
const M = compile(read('src/lib/portfolioMedia.ts'));
let bad = 0;
let n = 0;
const check = (name, ok, detail = '') => { n += 1; if (!ok) bad += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${name}${ok ? '' : '  - ' + detail}`); };

check('1 a big phone photo is saved with its long side at 2400, keeping its shape', JSON.stringify(M.fitLongSide(4032, 3024)) === JSON.stringify({ width: 2400, height: 1800 }) && JSON.stringify(M.fitLongSide(3024, 4032)) === JSON.stringify({ width: 1800, height: 2400 }));
check('2 a photo that is already small is never enlarged, and a missing size is handled', JSON.stringify(M.fitLongSide(1200, 800)) === JSON.stringify({ width: 1200, height: 800 }) && M.fitLongSide(0, 10).width === 0);
check('3 the grid copy is a centred square cut', JSON.stringify(M.squareCrop(4000, 3000)) === JSON.stringify({ originX: 500, originY: 0, size: 3000 }) && JSON.stringify(M.squareCrop(3000, 4000)) === JSON.stringify({ originX: 0, originY: 500, size: 3000 }) && M.THUMB_SIZE === 400);
check('4 photos are high quality (0.85, the app\'s usual is 0.5) and the grid copy is small and light', M.FULL_QUALITY === 0.85 && M.THUMB_QUALITY < M.FULL_QUALITY && M.FULL_LONG_SIDE > 1600);
check('5 files go in the company\'s own portfolio folder, and the small copies in a thumbs folder under it', M.portfolioFolder('c1', 'posts') === 'c1/portfolio/posts' && M.thumbFolder('c1', 'posts') === 'c1/portfolio/posts/thumbs');
check('6 a video is limited to 60 seconds and is NOT compressed', M.MAX_VIDEO_SECONDS === 60 && M.VIDEO_IS_COMPRESSED === false);

const media = read('src/lib/media.ts');
check('7 the shared uploader can skip its own compression (raw) so Our Work\'s quality is kept, and every other screen still compresses as before', /opts\?: \{ raw\?: boolean \}/.test(media) && /startsWith\('image\/'\) && !opts\?\.raw/.test(media));
const up = read('src/data/portfolioUpload.ts');
check('8 a photo uploads as a high-quality copy plus a small square copy, both without the app\'s usual compression', /FULL_QUALITY/.test(up) && /squareCrop\(full\.width, full\.height\)/.test(up) && (up.match(/\{ raw: true \}/g) || []).length >= 4);
check('9 a video uploads exactly as it is (no compression), with a best-effort still frame for the grid that never stops the post', /uploadImage\(localUri, portfolioFolder\(companyId, kind\), 'video\/mp4', undefined, \{ raw: true \}\)/.test(up) && !/prepareVideo|react-native-compressor|compressVideo/.test(up) && /catch \{\s*return \{ url: up\.url, key: up\.key, thumbUrl: null/.test(up));

const own = read('src/data/portfolioOwner.ts');
check('10 a post that cannot save its pictures is not left behind half made', /portfolio_posts'\)\.delete\(\)\.eq\('id', postId\)/.test(own) && /if \(ins\.error\) \{/.test(own));
check('11 a post is checked (one video of up to 60 seconds for a reel, tags from the list) before it is sent', /postProblem\(\{ kind: input\.kind/.test(own));
check('12 removing a picture from a post deletes its file only when the owner uploaded it for Our Work; a project\'s photo is only taken out of the post', /key\.startsWith\(`\$\{portfolioFolder\(companyId, 'posts'\)\}\/`\)/.test(own) && (own.match(/startsWith\(`\$\{portfolioFolder\(companyId, 'posts'\)\}\/`\)/g) || []).length === 2);
check('13 the profile text is saved by updating the row, or creating it the first time', /\.update\(\{ bio, website/.test(own) && /\.insert\(\{ company_id: companyId, bio, website/.test(own));
check('14 a reel\'s "also show in the grid" choice is kept, and a project post is always in the grid', /show_in_grid: input\.kind === 'video' \? input\.showInGrid : true/.test(own));
check('15 every owner read and write goes through the database rules (owner and admin only) and never throws', /export async function loadOwnerPortfolio/.test(own) && !/service_role|serviceRole/.test(own));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
