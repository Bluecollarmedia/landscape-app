// Run: node scripts/checks/ourWork.check.cjs <path to typescript package>
// "Our Work" (the portfolio): the pure rules (grid, videos, counts, highlights, music clip, scrub bar, owner checks) and the database file (update 115).
const ts = require(process.argv[2] || 'typescript');
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
const compile = (src) => {
  const m = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(src, { compilerOptions: { module: 'commonjs', esModuleInterop: true } }).outputText)(m, m.exports, (name) => (name === '@/lib/mediaFormats' ? compile(read('src/lib/mediaFormats.ts')) : {}));
  return m.exports;
};
const L = compile(read('src/lib/portfolio.ts'));
let bad = 0;
let n = 0;
const check = (name, ok, detail = '') => { n += 1; if (!ok) bad += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${name}${ok ? '' : '  - ' + detail}`); };

const media = (id, kind, o = {}) => ({ id, kind, url: `u/${id}`, thumb_url: kind === 'video' ? `t/${id}` : null, duration_s: kind === 'video' ? 24 : null, position: 0, ...o });
const post = (id, o = {}) => ({ id, kind: 'post', caption: '', town: 'Lakewood', taken_on: '', tags: [], show_in_grid: true, posted_at: '2026-10-01T00:00:00Z', cover_url: null, music_url: null, music_title: null, music_start_s: null, music_end_s: null, music_fade: true, keep_video_sound: false, media: [media(`${id}a`, 'photo')], ...o });

check('1 a length reads as 0:24 and 1:05, and nothing when there is none', L.formatDuration(24) === '0:24' && L.formatDuration(65) === '1:05' && L.formatDuration(null) === '' && L.formatDuration(-3) === '');

const p1 = post('p1', { posted_at: '2026-10-01T00:00:00Z' });
const p2 = post('p2', { posted_at: '2026-10-05T00:00:00Z', cover_url: 'cover/x' });
const v1 = post('v1', { kind: 'video', show_in_grid: false, posted_at: '2026-10-07T00:00:00Z', media: [media('v1a', 'video')] });
const v2 = post('v2', { kind: 'video', show_in_grid: true, posted_at: '2026-10-08T00:00:00Z', media: [media('v2a', 'video')] });
const mixed = post('m1', { posted_at: '2026-10-09T00:00:00Z', media: [media('m1a', 'photo', { position: 1 }), media('m1b', 'video', { position: 0 })] });
const all = [p1, p2, v1, v2, mixed];

check('2 the cover is the owner\'s pick, else the first photo, else the video\'s frame', L.postCoverUrl(p2) === 'cover/x' && L.postCoverUrl(p1) === 'u/p1a' && L.postCoverUrl(v1) === 't/v1a');
check('3 the photo grid has every project post and only the video posts the owner chose to show there, newest first', L.gridPosts(all).map((p) => p.id).join() === 'm1,v2,p2,p1', L.gridPosts(all).map((p) => p.id).join());
check('4 the Videos tab has only the reels (never the videos inside a photo post), newest first, each with its length', L.videoEntries(all).map((e) => e.media.id).join() === 'v2a,v1a' && L.videoEntries(all)[0].media.duration_s === 24);
const counts = L.portfolioCounts([post('a', { tags: ['Pavers', 'Turf'], media: [media('1', 'photo'), media('2', 'photo'), media('3', 'video')] }), post('b', { tags: ['Turf'] }), v1]);
check('5 the profile counts come from the posts: projects, photos and distinct services', counts.projects === 2 && counts.photos === 3 && counts.services === 2, JSON.stringify(counts));

const byTag = { id: 'h1', name: 'Patios', cover_url: null, mode: 'tag', tag: 'Pavers', position: 1, post_ids: [] };
const tagged = [post('t1', { tags: ['Pavers'], posted_at: '2026-10-02T00:00:00Z' }), post('t2', { tags: ['Pavers'], posted_at: '2026-10-04T00:00:00Z' }), post('t3', { tags: ['Turf'] })];
check('6 an automatic highlight follows its tag (newest first), so new posts join on their own', L.postsForHighlight(byTag, tagged).map((p) => p.id).join() === 't2,t1');
const manual = { ...byTag, id: 'h2', mode: 'manual', tag: null, post_ids: ['t3', 'gone', 't1'] };
check('7 a hand-picked highlight keeps the owner\'s order and skips posts that no longer exist', L.postsForHighlight(manual, tagged).map((p) => p.id).join() === 't3,t1');
check('8 a highlight with nothing in it is not shown, and the rest follow the owner\'s order', L.visibleHighlights([{ ...byTag, id: 'e', tag: 'Snow', position: 0 }, { ...byTag, position: 3 }, { ...manual, position: 2 }], tagged).map((h) => h.id).join() === 'h2,h1');
check('9 a circle with no picture of its own uses the first post\'s cover', L.highlightCoverUrl(byTag, tagged) === 'u/t2a' && L.highlightCoverUrl({ ...byTag, cover_url: 'mine' }, tagged) === 'mine');

check('10 a chosen part of a track stays inside the track and between 5 and 60 seconds', JSON.stringify(L.normalizeClip(48, 200, 192)) === JSON.stringify({ startS: 48, endS: 108 }) && L.normalizeClip(190, 195, 192).endS <= 192 && L.clipLengthS(L.normalizeClip(10, 11, 192)) >= 5 && L.clipLengthS(L.normalizeClip(-5, 400, 500)) <= 60);
check('11 a track shorter than 5 seconds plays whole', JSON.stringify(L.normalizeClip(0, 3, 3)) === JSON.stringify({ startS: 0, endS: 3 }));
const clip = { startS: 48, endS: 78 };
check('12 the part loops: at its end it jumps back to its start, otherwise it keeps playing', L.nextLoopPosition(78, clip) === 48 && L.nextLoopPosition(79, clip) === 48 && L.nextLoopPosition(60, clip) === null && L.nextLoopPosition(10, clip) === 48);
check('13 the fade-out is the last 2 seconds only, and only when it is on', L.clipVolume(60, clip, true) === 1 && L.clipVolume(77, clip, true) === 0.5 && L.clipVolume(78, clip, true) === 0 && L.clipVolume(77, clip, false) === 1);
check('14 the scrub bar maps a touch to a time and back, never outside the video', L.timeAtFraction(0.5, 24) === 12 && L.timeAtFraction(2, 24) === 24 && L.fractionOf(9, 24) === 0.375 && L.fractionOf(5, 0) === 0);
check('15 the bar is thicker while a finger is on it', L.SCRUB_BAR_HEIGHT.scrubbing > L.SCRUB_BAR_HEIGHT.resting * 3);

const ok = { kind: 'post', caption: 'hi', town: 'Howell', tags: ['Pavers'], media: [{ kind: 'photo', duration_s: null }], music: null };
check('16 a post needs at least one photo or video; a video post holds exactly one video of up to 60 seconds', L.postProblem(ok) === null && !!L.postProblem({ ...ok, media: [] }) && !!L.postProblem({ ...ok, kind: 'video', media: [{ kind: 'photo', duration_s: null }] }) && !!L.postProblem({ ...ok, media: [{ kind: 'video', duration_s: 61 }] }) && L.postProblem({ ...ok, kind: 'video', media: [{ kind: 'video', duration_s: 59 }] }) === null);
check('17 tags come from the list, the caption has a limit, and music needs a real part', !!L.postProblem({ ...ok, tags: ['Free money'] }) && !!L.postProblem({ ...ok, caption: 'x'.repeat(2201) }) && !!L.postProblem({ ...ok, music: { url: 'm', startS: 10, endS: 10 } }) && L.postProblem({ ...ok, music: { url: 'm', startS: 10, endS: 40 } }) === null);
check('18 dragging reorders a list and ignores impossible moves', L.moveItem(['a', 'b', 'c'], 0, 2).join() === 'b,c,a' && L.moveItem(['a', 'b'], 5, 0).join() === 'a,b');
const req = L.requestNoteFor({ town: 'Lakewood', caption: '', tags: ['Pavers', 'Lighting', 'Planting'] });
check('19 "Want something like this?" pre-fills the services and a note with the town', req.services.join() === 'Pavers, Patios & Walkways,Lighting & Planting' && /Lakewood/.test(req.note), JSON.stringify(req));

// ── the database file ──
const sql = read('supabase/updates/115_our_work.sql');
check('20 Our Work is OFF until the owner turns it on, and only the owner can turn it on', /enabled boolean not null default false/.test(sql) && /set_portfolio_enabled/.test(sql) && /m\.role = 'owner' and m\.status = 'active'\s*limit 1/.test(sql) && !/grant update \([^)]*enabled/.test(sql));
check('21 visitors can read the feed only through public_portfolio, which answers only while the switch is on and only visible posts', /grant execute on function public\.public_portfolio\(\) to anon, authenticated/.test(sql) && /where s\.enabled/.test(sql) && /and visible/.test(sql) && /revoke all on public\.portfolio_settings, public\.portfolio_posts[^;]*from public, anon, authenticated/.test(sql));
check('22 only the owner or an admin can read or change the tables, and the public feed carries no customer name, address or project link', /m\.role in \('owner','admin'\)/.test(sql) && !/'project_id'|customer|address/.test(sql.slice(sql.indexOf('function public.public_portfolio()'))));
check('23 videos are limited to 60 seconds and a post has at most 8 tags and a 2200-character caption', /duration_s <= 60/.test(sql) && /cardinality\(tags\) <= 8/.test(sql) && /char_length\(caption\) <= 2200/.test(sql));

const data = read('src/data/portfolio.ts');
check('24 the app asks the database through the two public functions and changes the switch through the owner-only one', /rpc\('public_portfolio_config'\)/.test(data) && /rpc\('public_portfolio'\)/.test(data) && /rpc\('set_portfolio_enabled'/.test(data));
// ── the screens visitors see ──
const bar = read('src/components/weather/FloatingTabBar.tsx');
check('25 the Our Work tab is in the bar only while the owner\'s switch is on', /usePortfolioEnabled\(\)/.test(bar) && /tab\.path !== '\/weather\/work' \|\| workOn/.test(bar));
const lay = read('app/weather/(tabs)/_layout.tsx');
const stackLay = read('app/weather/_layout.tsx');
check('26 the Weather area has the Our Work tab and, as screens in a stack above the tabs (so they swipe back and close for real), the project and the full-screen video', /name="work"/.test(lay) && /<Stack\.Screen name="work-post" \/>/.test(stackLay) && /<Stack\.Screen name="work-video" \/>/.test(stackLay) && !/work-post/.test(lay));
const work = read('app/weather/(tabs)/work.tsx');
check('27 Our Work has the profile counts, the circles, the photo grid and (one swipe to the left) the videos, each video tile showing its length', /portfolioCounts/.test(work) && /visibleHighlights/.test(work) && /gridPosts/.test(work) && /videoEntries/.test(work) && /pagingEnabled/.test(work) && /formatDuration\(seconds\)/.test(work));
check('28 Our Work has no follower count, no follow button and no likes', !/follow|likes/i.test(work) && !/follow|likes/i.test(read('app/weather/work-post.tsx')));
const postScreen = read('app/weather/work-post.tsx');
check('29 a project\'s music plays only while the project is open and on screen, can be muted from its chip, and waits while a video with its own sound is showing', /useIsFocused/.test(postScreen) && /useClipMusic/.test(postScreen) && /setMuted\(\(m\) => !m\)/.test(postScreen) && /keep_video_sound && onVideo/.test(postScreen));
check('30 "Want something like this?" opens the Request form already filled in', /requestNoteFor/.test(postScreen) && /pathname: '\/weather\/request'/.test(postScreen) && /useLocalSearchParams<\{ services\?: string; note\?: string \}>/.test(read('app/weather/(tabs)/request.tsx')));
const vid = read('app/weather/work-video.tsx');
const scrub = read('src/components/work/ScrubBar.tsx');
check('31 the full-screen video shows its length, has a sound button (off to start), pauses on tap, and a seek bar that grows under a finger and dims the screen', /formatDuration\(now\)/.test(vid) && /useState\(false\)/.test(vid) && /setPaused/.test(vid) && /<ScrubBar/.test(vid) && /scrubbing \? <View style=\{styles\.dim\}/.test(vid) && /SCRUB_BAR_HEIGHT\.scrubbing/.test(scrub) && /PanResponder/.test(scrub));
const clipHook = read('src/components/work/useClipMusic.ts');
check('32 the music part loops and fades through the tested rules', /nextLoopPosition/.test(clipHook) && /clipVolume/.test(clipHook) && /player\.pause\(\)/.test(clipHook));
check('33 Our Work has Spanish', /'Our Work': /.test(read('src/i18n/es.weather.ts')) && /'Want something like this\? Request a quote'/.test(read('src/i18n/es.weather.ts')));

check('34 a project with 10 photos loads only the one on screen (then quietly the next), never all of them at once', L.shouldLoadSlide(0, 0) === true && [1, 2, 3, 4, 5, 6, 7, 8, 9].every((i) => L.shouldLoadSlide(i, 0) === false) && /initialNumToRender=\{1\}/.test(read('app/weather/work-post.tsx')) && /load=\{shouldLoadSlide\(i, index\)\}/.test(read('app/weather/work-post.tsx')) && /if \(!load\) return/.test(read('app/weather/work-post.tsx')) && /prefetch\(next\.url\)/.test(read('app/weather/work-post.tsx')));
check('35 the grid draws 30 tiles at first and 30 more near the end, and each tile uses the small picture when there is one', L.GRID_PAGE === 30 && L.growCount(30, 100) === 60 && L.growCount(90, 100) === 100 && /grid\.slice\(0, gridCount\)/.test(read('app/weather/(tabs)/work.tsx')) && L.postGridUrl({ ...post('g'), cover_thumb_url: 'small', cover_url: 'big' }) === 'small' && L.postGridUrl({ ...post('g2'), media: [media('x', 'photo', { thumb_url: 'tiny' })] }) === 'tiny' && L.postGridUrl(post('g3')) === 'u/g3a');
check('36 switching apps pauses the video and the music where they are, and they carry on from the same spot (nothing is reset or torn down)', /useIsFocused\(\) && useAppActive\(\)/.test(read('app/weather/work-post.tsx')) && /useIsFocused\(\) && useAppActive\(\)/.test(read('app/weather/work-video.tsx')) && /AppState\.addEventListener\('change'/.test(read('src/hooks/useAppActive.ts')) && !/currentTime = 0/.test(read('app/weather/work-video.tsx')));
// ── reels (swipe up through the videos) ──
const reels = L.videoEntries(all);
check('37 a reel opens at its own place in the list of reels, and at the first one when it is not found (-1 only when there are no reels)', L.reelIndexOf(reels, 'v1a') === 1 && L.reelIndexOf(reels, 'nope') === 0 && L.reelIndexOf([], 'v2a') === -1);
check('38 only the NEXT reel is prepared, and only once the one on screen has started playing; never two at once', L.reelToPreload(0, false, 3) === null && L.reelToPreload(0, true, 3) === 1 && L.reelToPreload(2, true, 3) === null && [0, 1, 2, 3].filter((i) => L.reelMode(i, 1, L.reelToPreload(1, true, 4)) !== 'idle').length === 2);
check('39 a post that is only a video opens as a reel; a post with photos opens as a project', L.opensAsReel({ kind: 'video' }) === true && L.opensAsReel({ kind: 'post' }) === false && /opensAsReel\(p\)/.test(read('app/weather/(tabs)/work.tsx')));
const reelScreen = read('app/weather/work-video.tsx');
check('40 the reels screen swipes up for the next reel, prepares only the next one after the current one has started, gives each reel a fresh player, and stops the scroll while the seek bar is held', /pagingEnabled/.test(reelScreen) && /reelToPreload\(active, started, entries\.length\)/.test(reelScreen) && /mode === 'idle'/.test(reelScreen) && /useVideoPlayer\(item\.url/.test(reelScreen) && /scrollEnabled=\{!scrubbing\}/.test(reelScreen));
check('41 a reel that is not the one on screen or the next one is only a still picture (no player, nothing loading)', /if \(mode === 'idle'\) \{\s*return <View style=\{\{ height, backgroundColor: '#0E1A12' \}\}>\{poster \?/.test(reelScreen));
check('42 a video inside a post plays by itself when swiped to and has no seek bar (it cannot be skipped through), and every slide in a post is a square', /<VideoView player=\{player\} style=\{\{ width: size, height: size \}\} contentFit="cover" nativeControls=\{false\}/.test(read('app/weather/work-post.tsx')) && !/ScrubBar/.test(read('app/weather/work-post.tsx')) && /style=\{\{ width, height: width/.test(read('app/weather/work-post.tsx')));

// ── Stage 4: music and covers ──
const Q = compile(read('src/lib/portfolio.ts'));
check('43 a new track starts about a quarter in (skipping a slow intro) for a long track, at the beginning for a short one, 30 seconds long', JSON.stringify(Q.defaultClip(192)) === JSON.stringify({ startS: 48, endS: 78 }) && JSON.stringify(Q.defaultClip(40)) === JSON.stringify({ startS: 0, endS: 30 }));
check('44 dragging the whole part along the track keeps its length and stops at the ends', JSON.stringify(Q.moveClip({ startS: 48, endS: 78 }, 192, 100)) === JSON.stringify({ startS: 100, endS: 130 }) && Q.moveClip({ startS: 48, endS: 78 }, 192, 500).endS === 192 && Q.moveClip({ startS: 48, endS: 78 }, 192, -20).startS === 0);
check('45 the left handle keeps the end and the part between 5 and 60 seconds; the right handle keeps the start and stays inside the track', Q.dragClipStart({ startS: 48, endS: 78 }, 192, 75).startS === 73 && Q.dragClipStart({ startS: 48, endS: 78 }, 192, 0).startS === 18 && Q.dragClipEnd({ startS: 48, endS: 78 }, 192, 300).endS === 108 && Q.dragClipEnd({ startS: 48, endS: 78 }, 192, 49).endS === 53);
check('46 the handles sit at the right fractions of the timeline, and the ruler marks follow the track length', JSON.stringify(Q.clipFractions({ startS: 48, endS: 96 }, 192)) === JSON.stringify({ start: 0.25, end: 0.5 }) && Q.rulerMarks(100).join() === '0,10,20,30,40,50,60,70,80,90,100' && Q.rulerMarks(200).join() === '0,30,60,90,120,150,180' && Q.rulerMarks(0).length === 0);
check('47 the music chip name comes from the file name, and only audio files are accepted', Q.trackTitleFromFile('Sunset-Drive_final.mp3') === 'Sunset Drive final' && Q.trackTitleFromFile('.mp3') === 'My track' && Q.isUsableTrack('a.MP3') && Q.isUsableTrack('x', 'audio/mp4') && !Q.isUsableTrack('photo.jpg', 'image/jpeg'));
check('48 the strip of video frames is spread evenly along the video', Q.frameTimes(24, 8).join() === '1.5,4.5,7.5,10.5,13.5,16.5,19.5,22.5' && Q.frameTimes(0, 8).length === 0);
const server = read('supabase/functions/media/index.ts');
const mediaLib = read('src/lib/media.ts');
check('49 the media function accepts MP3, M4A, AAC and WAV (redeploy it), and the app knows these as audio', /'audio\/mpeg': 'mp3'/.test(server) && /'audio\/mp4': 'm4a'/.test(server) && /'audio\/aac': 'aac'/.test(server) && /'audio\/wav': 'wav'/.test(server) && /audioFormatOf\(lower, mime\)/.test(mediaLib) && /videoFormatOf\(lower, mime\)/.test(mediaLib));
const music = read('src/components/work/MusicEditor.tsx');
const musicData = read('src/data/portfolioMusic.ts');
check('50 the owner imports their own track from the phone (a size limit, audio only), and the screen has a timeline with two handles and a middle to drag, readouts, and a play button that stops at the end of the part', /getDocumentAsync\(\{ type: \['audio\/\*'\]/.test(musicData) && /MAX_TRACK_MB/.test(musicData) && /pans\.start\.panHandlers/.test(music) && /pans\.end\.panHandlers/.test(music) && /pans\.move\.panHandlers/.test(music) && /Starts at/.test(music) && /Ends at/.test(music) && /currentTime >= clip\.endS/.test(music) && /Play the selected part/.test(music));
check('51 the music screen has the fade-out switch, "keep the video\'s own sound" (only when the post has a video), the rights note, and Remove / Use this part', /Fade out at the end/.test(music) && /hasVideo \? \(/.test(music) && /Keep the video's own sound/.test(music) && /Popular songs are usually not allowed/.test(music) && /Remove music/.test(music) && /Use this part/.test(music));
const cover = read('src/components/work/CoverEditor.tsx');
check('52 the cover can be a photo from the post, a frame of a video (slide along a strip of frames), or a picture from the phone, then zoom and crop to a square with the app\'s crop screen', /Pick a frame of this video/.test(cover) && /frameTimes\(duration, 8\)/.test(cover) && /PanResponder/.test(cover) && /Upload a picture from my phone/.test(cover) && /<PhotoCropper image=\{step === 'crop' \? crop : null\} aspect=\{1\}/.test(cover) && /Use the first picture \(automatic\)/.test(cover));
const edr = read('src/components/work/PostEditorScreen.tsx');
check('53 saving uploads the track once (with its start and end) and the cover (high quality plus a small grid copy), and music and cover can be changed or removed on an old post', /uploadTrack\(music\.track, companyId\)/.test(edr) && /uploadPortfolioPhoto\(coverLocal, companyId, 'covers'\)/.test(edr) && /music_url: musicInput\?\.url \?\? null/.test(edr) && /coverReset/.test(edr) && /<MusicEditor visible=\{musicOpen\}/.test(edr) && /<CoverEditor visible=\{coverOpen\}/.test(edr));
check('54 a new post saves its music and cover with it', /music: musicInput, coverUrl: cover\?\.url \?\? null/.test(edr) && /music_url: input\.music\?\.url \?\? null/.test(read('src/data/portfolioOwner.ts')));

// ── file formats ──
const F = compile(read('src/lib/mediaFormats.ts'));
const okAudio = [['song.mp3'], ['song.M4A'], ['voice.aac'], ['loop.wav'], ['pad.aiff'], ['pad.aif'], ['iphone.caf'], ['lossless.flac'], ['x', 'audio/mpeg'], ['x', 'audio/x-m4a'], ['x', 'audio/flac']];
check('55 music: MP3, M4A, AAC, WAV, AIFF, CAF and FLAC are accepted, by file name or by type', okAudio.every(([n, m]) => F.audioProblem(n, m) === null));
check('56 music: formats only some phones play (OGG, Opus, WMA) are turned away with a plain message, and so are non-audio files', /not play on every phone/.test(F.audioProblem('a.ogg')) && /not play on every phone/.test(F.audioProblem('a.wma')) && /Choose an audio file/.test(F.audioProblem('photo.jpg', 'image/jpeg')));
check('57 music: each format is named correctly for upload (an M4A is not called an MP3)', F.audioFormatOf('a.m4a').contentType === 'audio/mp4' && F.audioFormatOf('a.flac').ext === 'flac' && F.audioFormatOf('a.mp3').contentType === 'audio/mpeg' && F.audioFormatOf('a.wav').contentType === 'audio/wav');
check('58 video: MP4, MOV (iPhone), M4V and 3GP are accepted', ['a.mp4', 'a.MOV', 'a.m4v', 'a.3gp'].every((n) => F.videoProblem(n) === null) && F.videoProblem('x', 'video/quicktime') === null && F.videoFormatOf('a.mov').contentType === 'video/quicktime' && F.videoFormatOf('a.3gp').contentType === 'video/3gpp');
check('59 video: WebM, MKV and AVI are turned away with a plain message; a file whose name is unknown is let through (the phone\'s own library only holds normal videos)', /do not play on every phone/.test(F.videoProblem('a.webm')) && /do not play on every phone/.test(F.videoProblem('a.mkv')) && /do not play on every phone/.test(F.videoProblem('a.avi')) && F.videoProblem(null, null) === null && F.videoProblem('', 'video/mp4') === null);
check('60 pictures: JPEG, PNG, WebP, HEIC/HEIF, GIF, BMP, TIFF and AVIF are accepted, and something that is not a picture is turned away', ['a.jpg', 'a.PNG', 'a.webp', 'a.heic', 'a.heif', 'a.gif', 'a.bmp', 'a.tiff', 'a.avif'].every((n) => F.imageProblem(n) === null) && F.imageProblem('x', 'image/jpeg') === null && /Choose a picture/.test(F.imageProblem('doc.pdf', 'application/pdf')));
const srv = read('supabase/functions/media/index.ts');
check('61 the media function accepts every audio and video format listed here (redeploy it)', ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/aiff', 'audio/x-caf', 'audio/flac', 'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/3gpp'].every((t) => srv.includes(`'${t}'`)));
const ed2 = read('src/components/work/PostEditorScreen.tsx');
check('62 the pickers check the format before anything is uploaded (posts, reels, stories, music), and photos are re-saved as JPEG so any picture the phone opens works', /videoProblem\(a\.fileName \?\? a\.uri, a\.mimeType\)/.test(ed2) && /imageProblem\(a\.fileName \?\? a\.uri, a\.mimeType\)/.test(ed2) && /videoProblem\(a\.fileName/.test(read('src/components/work/StoriesManagerScreen.tsx')) && /audioProblem\(a\.name, a\.mimeType\)/.test(read('src/data/portfolioMusic.ts')) && /format: SaveFormat\.JPEG/.test(read('src/data/portfolioUpload.ts')));

// ── highlights play like a story that never expires ──
const hlTag = { id: 'h', name: 'Patios', cover_url: null, mode: 'tag', tag: 'Pavers', position: 0, post_ids: [] };
const hp = [post('a', { tags: ['Pavers'], posted_at: '2026-10-05T00:00:00Z', media: [media('a1', 'photo', { position: 1 }), media('a2', 'video', { position: 0 })] }), post('b', { tags: ['Pavers'], posted_at: '2026-10-02T00:00:00Z' }), post('c', { tags: ['Turf'] })];
const frames = L.highlightFrames(hlTag, hp);
check('63 a highlight plays the photos and videos of its posts one after another (newest post first, each post in its own order)', frames.map((f) => f.media_id).join() === 'a2,a1,ba' && frames.map((f) => f.kind).join() === 'video,photo,photo', frames.map((f) => f.media_id).join());
check('64 a highlight\'s frames never expire, and a video frame keeps its own length', frames.every((f) => Date.parse(f.expires_at) > Date.parse('3000-01-01')) && frames[0].duration_s === 24);
check('65 one circle never plays for ages (at most 60 frames)', L.highlightFrames(hlTag, [post('big', { tags: ['Pavers'], media: Array.from({ length: 80 }, (_, i) => media(`m${i}`, 'photo', { position: i })) })]).length === 60);
const home2 = read('app/weather/(tabs)/work.tsx');
const viewer2 = read('app/weather/work-story.tsx');
check('66 tapping a circle opens the story viewer (not a grid sheet), and the old sheet is gone', /pathname: '\/weather\/work-story', params: \{ highlight: h\.id \}/.test(home2) && !/<Modal/.test(home2) && !/setOpen/.test(home2));
check('67 the story viewer plays a highlight (its name at the top, no "2h" age), with the same taps, hold and swipe down, does not remember it as watched, and has a button to open the post or reel', /highlightFrames\(hl, feed\.posts\)/.test(viewer2) && /hl \? hl\.name/.test(viewer2) && /if \(story && !hl\)/.test(viewer2) && /See reel/.test(viewer2) && /See project/.test(viewer2));

check('68 a reel video runs full screen to the bottom edge and has only a short soft fade at the very bottom (at most 55% dark, at most 300 high), never over the whole video', /<VideoView player=\{player\} style=\{StyleSheet\.absoluteFill\} contentFit="cover"/.test(read('app/weather/work-video.tsx')) && /rgba\(8,16,12,0\.55\)'\]/.test(read('app/weather/work-video.tsx')) && /Math\.min\(300, height \* 0\.3\)/.test(read('app/weather/work-video.tsx')) && !/rgba\(8,16,12,0\.85\)/.test(read('app/weather/work-video.tsx')));
const mgrSrc = read('src/components/work/OurWorkManagerScreen.tsx');
check('69 the owner can change the profile picture (pick a photo, crop it square, saved and shown at once) or go back to the leaf logo, in More > Our Work > About us', /Profile picture/.test(mgrSrc) && /allowsEditing: true, aspect: \[1, 1\]/.test(mgrSrc) && /avatarUrl: up\.thumbUrl/.test(mgrSrc) && /Use the leaf/.test(mgrSrc) && /avatarUrl: null/.test(mgrSrc) && /keepPicked\(result\.assets\[0\]\.uri/.test(mgrSrc));
const sql2 = read('supabase/updates/115_our_work.sql');
check('70 the picture is stored with the profile (in the unrun database file) and reaches visitors through the public feed', /avatar_url text check/.test(sql2) && /'avatar_url', s\.avatar_url/.test(sql2) && /grant update \(handle, bio, website, avatar_url/.test(sql2));
check('71 the chosen picture shows on the profile, in stories, and beside the name in a project and a reel (the leaf when none is chosen)', ['app/weather/(tabs)/work.tsx', 'app/weather/work-story.tsx', 'app/weather/work-post.tsx', 'app/weather/work-video.tsx'].every((f) => /<ProfileAvatar uri=\{/.test(read(f)) && !/logo-leaf/.test(read(f))) && /logo-leaf/.test(read('src/components/work/ProfileAvatar.tsx')));
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
