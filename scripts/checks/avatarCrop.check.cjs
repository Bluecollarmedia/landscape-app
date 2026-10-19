// Run: node scripts/checks/avatarCrop.check.cjs <path to typescript package>
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/lib/avatarCrop.ts'), 'utf8');
const m = { exports: {} };
let manipulatorCalls = [];
let failManipulator = false;
const req = (n) => {
  if (n === 'expo-image-manipulator') {
    return {
      SaveFormat: { JPEG: 'jpeg' },
      ImageManipulator: {
        manipulate: (uri) => {
          if (failManipulator) throw new Error('native failure');
          const ctx = { crop: (c) => { manipulatorCalls.push(['crop', c]); return ctx; }, resize: (r) => { manipulatorCalls.push(['resize', r]); return ctx; }, renderAsync: async () => ({ saveAsync: async (o) => { manipulatorCalls.push(['save', o]); return { uri: 'file:///cropped.jpg' }; } }) };
          return ctx;
        },
      },
    };
  }
  return {};
};
new Function('module', 'exports', 'require', ts.transpileModule(src, { compilerOptions: { module: 'commonjs' } }).outputText)(m, m.exports, req);
const { centerSquare, squareAvatarUri, AVATAR_PIXELS } = m.exports;

let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  — ' + detail}`); };

(async () => {
  const wide = centerSquare(4000, 3000); const tall = centerSquare(3000, 4000); const sq = centerSquare(1000, 1000);
  check('1 a wide picture is cut to a centred square', wide.size === 3000 && wide.originX === 500 && wide.originY === 0, JSON.stringify(wide));
  check('2 a tall picture is cut to a centred square', tall.size === 3000 && tall.originX === 0 && tall.originY === 500, JSON.stringify(tall));
  check('3 a square picture is kept whole', sq.size === 1000 && sq.originX === 0 && sq.originY === 0);
  check('4 bad sizes give nothing to crop', centerSquare(0, 100) === null && centerSquare(undefined, 100) === null && centerSquare(NaN, NaN) === null);
  let out = await squareAvatarUri('file:///big.jpg', 4000, 3000);
  const crop = manipulatorCalls.find((c) => c[0] === 'crop')[1];
  check('5 crops the centre square, shrinks it to the avatar size, saves a JPEG', out === 'file:///cropped.jpg' && crop.width === 3000 && crop.originX === 500 && manipulatorCalls.find((c) => c[0] === 'resize')[1].width === AVATAR_PIXELS && manipulatorCalls.find((c) => c[0] === 'save')[1].format === 'jpeg');
  manipulatorCalls = [];
  out = await squareAvatarUri('file:///small.jpg', 300, 200);
  check('6 a small picture is not blown up', manipulatorCalls.find((c) => c[0] === 'resize')[1].width === 200);
  out = await squareAvatarUri('file:///unknown.jpg');
  check('7 unknown size: the original picture is used (still works)', out === 'file:///unknown.jpg');
  failManipulator = true;
  out = await squareAvatarUri('file:///x.jpg', 100, 100);
  check('8 if the phone fails to crop, the original picture is used (never throws)', out === 'file:///x.jpg');
  console.log(bad ? `\n${bad} failed` : '\nall passed');
  process.exit(bad ? 1 : 0);
})();
