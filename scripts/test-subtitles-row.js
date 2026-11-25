#!/usr/bin/env node
// NATIVE_CONTRACT 44.14: the Subtitles row on the download page. The phase to line/button table, the season-pack
// count, when the row shows, the sheet's initial event, and the wiring on both pages. Pure: no rendering.
process.removeAllListeners('warning');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
function check(name, cond) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.error(`  FAIL ${name}`);
  }
}

(async () => {
  const M = await import('../components/subtitles/rowModel.ts');
  const copy = await import('../utils/subtitles/copy.ts');
  const SM = await import('../components/subtitles/sheetMachine.ts');
  const base = { fileListKnown: true, started: true, canOpenSheet: true };
  const row = (o) => M.rowModel({ ...base, ...o });
  const btn = (m) => (m.button ? `${m.button.label}/${m.button.action}` : null);

  console.log('[44.14 table]');
  let m = row({ started: false });
  check('no request, no bytes: muted "When this file starts", no button', m.line === '파일 다운로드가 시작되면' && m.muted && m.button === null);
  m = row({});
  check('no request, bytes: "Not asked yet" + Find', m.line === '아직 요청하지 않음' && btn(m) === '찾기/find');
  m = row({ phase: 'queued', fileListKnown: false });
  check('queued, no file list: "Starts when the file list arrives" + Cancel', m.line === '파일 목록을 받으면 시작' && btn(m) === '취소/cancel');
  m = row({ phase: 'queued' });
  check('queued: "Waiting for the file" + Cancel', m.line === '파일 대기 중' && btn(m) === '취소/cancel' && m.glyph === 'getting');
  m = row({ phase: 'searching' });
  check('searching: "자막 검색 중…" + Cancel', m.line === '자막 검색 중…' && btn(m) === '취소/cancel');
  m = row({ phase: 'saved', language: 'en' });
  check('saved: "English · fits this release" + Change, saved badge', m.line === 'English · 영상 버전 일치' && btn(m) === '변경/find' && m.glyph === 'saved' && m.start === 'results');
  m = row({ phase: 'needs-pick' });
  check('needs-pick: "Close match found" + Pick one, on results, ? badge', m.line === '비슷한 자막을 찾음' && btn(m) === '선택/pick' && m.start === 'results' && m.glyph === 'needs-look');
  m = row({ phase: 'needs-pick', otherLang: 'fr' });
  check('needs-pick in another language: "Found in French only"', m.line === '프랑스어에서만 찾음' && btn(m) === '선택/pick');
  m = row({ phase: 'none' });
  check('none: "아직 찾지 못함" + 이름 수정, opens the name field', m.line === '아직 찾지 못함' && btn(m) === '이름 수정/edit-name' && m.start === 'edit-name');
  m = row({ phase: 'has-already', language: 'de' });
  check('has-already: "독일어 자막 있음" + 더 찾기', m.line === '독일어 자막 있음' && btn(m) === '더 찾기/find');
  m = row({ phase: 'offline' });
  check('offline: "Waiting for internet", no button', m.line === '인터넷 연결 대기' && m.button === null);
  m = row({ phase: 'limited' });
  check('limited: "A source is busy · retrying soon", no button', m.line === '검색 사이트 사용량 제한 · 잠시 후 재시도' && m.button === null);
  m = row({ phase: 'skipped' });
  check('skipped: "Skipped" + Find', m.line === '건너뜀' && btn(m) === '찾기/find');

  console.log('[no request: the stored state stands in]');
  m = row({ stored: { state: 'saved', lang: 'es' } });
  check('stored saved reads as saved, in Spanish', m.line === 'Spanish · 영상 버전 일치' && btn(m) === '변경/find');
  m = row({ stored: { state: 'needs-look', lang: 'en' } });
  check('stored needs-look reads as needs-pick', btn(m) === 'Pick one/pick');
  m = row({ stored: { state: 'getting', lang: 'en' } });
  check('stored getting has nothing to cancel', m.line === '자막 검색 중…' && m.button === null);
  check('a request wins over the stored state', row({ phase: 'none', stored: { state: 'saved', lang: 'en' } }).line === '아직 찾지 못함');

  console.log('[sheet-opening buttons need a target]');
  check('no target: Find, Change, Pick one and Edit name give no button', ['find', 'saved', 'needs-pick', 'none', 'skipped'].every((p) => (p === 'find' ? row({ canOpenSheet: false }) : row({ canOpenSheet: false, phase: p })).button === null));
  check('Cancel works without a target', btn(row({ canOpenSheet: false, phase: 'searching' })) === '취소/cancel');

  console.log('[season pack]');
  const files = { a: { phase: 'saved', tries: 1 }, b: { phase: 'needs-pick', tries: 1 }, c: { phase: 'needs-pick', tries: 1 }, d: { phase: 'queued', tries: 0 } };
  const pack = M.packCounts(files);
  check('counts per file', pack.total === 4 && pack.saved === 1 && pack.needYou === 2);
  check('one video is not a pack', M.packCounts({ a: { phase: 'saved', tries: 1 } }) === null && M.packCounts(undefined) === null);
  m = row({ phase: 'needs-pick', pack: { total: 10, saved: 8, needYou: 2 }, canOpenSheet: false });
  check('"8 of 10 saved · 2 need you" + See all (no single target needed)', m.line === '10개 중 8개 저장 · 2개 선택 필요' && btn(m) === '모두 보기/see-all');
  check('one needing you reads "needs"', copy.rowPackLine({ saved: 9, total: 10, needYou: 1 }) === '10개 중 9개 저장 · 1개 선택 필요' && copy.rowPackLine({ saved: 10, total: 10, needYou: 0 }) === '10개 저장');
  check('a skipped pack is just Skipped', row({ phase: 'skipped', pack: { total: 3, saved: 0, needYou: 0 } }).line === '건너뜀');

  console.log('[accessibility]');
  check('"Subtitles, {line}, button {label}"', row({ phase: 'needs-pick' }).a11y === '자막, 비슷한 자막을 찾음, 버튼 선택');
  check('no button: no "button" word', row({ phase: 'offline' }).a11y === '자막, 인터넷 연결 대기');

  console.log('[when the row shows]');
  const vid = (path, progressBytes, length = 1000) => ({ path, length, progressBytes, included: true, priority: 'normal', index: 0 });
  const avail = { master: true, sourcesOn: 1 };
  const t = { finished: false, folder: '/storage/emulated/0/Download/Maglev' };
  let f = M.torrentRowFacts(t, [vid('Film.mkv', 10)], avail, false);
  check('one video with bytes: shows, started, opens the sheet', f.show && f.started && f.canOpenSheet && f.file.path === 'Film.mkv');
  f = M.torrentRowFacts(t, [vid('Film.mkv', 0)], avail, false);
  check('one video, no bytes: shows, not started, sheet disabled', f.show && !f.started && !f.canOpenSheet);
  f = M.torrentRowFacts(t, [vid('S01E01.mkv', 10), vid('S01E02.mkv', 0)], avail, true);
  check('a pack shows with no single target', f.show && f.started && !f.canOpenSheet && f.file === null);
  check('no video: no row', !M.torrentRowFacts(t, [vid('album.flac', 10)], avail, false).show);
  check('master off: no row', !M.torrentRowFacts(t, [vid('Film.mkv', 10)], { master: false, sourcesOn: 1 }, false).show);
  check('no source on: no row', !M.torrentRowFacts(t, [vid('Film.mkv', 10)], { master: true, sourcesOn: 0 }, false).show);
  const d = { state: 'downloading', name: 'Clip.mp4', folder: '/storage/emulated/0/Download/Maglev', downloaded: 500 };
  check('link page: a video with bytes shows and opens', M.downloadRowFacts(d, avail).show && M.downloadRowFacts(d, avail).canOpenSheet);
  check('link page: not started shows, disabled', M.downloadRowFacts({ ...d, downloaded: 0 }, avail).show && !M.downloadRowFacts({ ...d, downloaded: 0 }, avail).started);
  check('link page: not a video, switch off, joining stream: no row', !M.downloadRowFacts({ ...d, name: 'a.zip' }, avail).show && !M.downloadRowFacts(d, { master: false, sourcesOn: 1 }).show && !M.downloadRowFacts({ ...d, muxNeeded: true }, avail).show);

  console.log('[the sheet opens where the row says]');
  let s = SM.sheetReducer(SM.CLOSED, { type: 'OPEN', languages: ['en'], needsNotice: false });
  check('default: results step, field closed', s.phase === 'searching' && !s.editing);
  s = SM.sheetReducer(SM.CLOSED, { type: 'OPEN', languages: ['en'], needsNotice: false, editName: 'Casino Royale 2006' });
  check('editName: the 42 field is open with that text', s.editing && s.draft === 'Casino Royale 2006' && s.phase === 'searching');
  s = SM.sheetReducer(SM.CLOSED, { type: 'OPEN', languages: ['en'], needsNotice: true, editName: 'x' });
  s = SM.sheetReducer(s, { type: 'NOTICE_CONTINUE' });
  check('editName survives the one-time notice', s.editing && s.draft === 'x');

  console.log('[wiring]');
  const row_ = read('components/subtitles/SubtitlesRow.tsx');
  check('row reads useRequestPhases, skipSubtitles for Cancel, and the stored state', /useRequestPhases\(/.test(row_) && /skipSubtitles\(requestKey\)/.test(row_) && /stateFor\(/.test(row_));
  check('row: 1 px border, 44 dp button, whole row pressable, shared 44.8 badge', /borderWidth: 1/.test(row_) && /minWidth: (?:44|touch\.min), minHeight: (?:44|touch\.min)/.test(row_) && /<PressableScale onPress=\{act\}/.test(row_) && /SubtitleBadge/.test(row_));
  check('row: theme roles only, no hex, no warning colour', !/#[0-9A-Fa-f]{3,6}\b/.test(row_) && !/colors\.warning/.test(row_));
  check('card icon exports the badge the row reuses', /export function SubtitleBadge/.test(read('components/subtitles/SubtitleCardIcon.tsx')));
  const tp = read('app/torrent/[id].tsx');
  const dp = read('app/download/[id].tsx');
  check('torrent page: row sits right after WhyStuck, before the next block', /<WhyStuck[^\n]*\n\n\s*\{subtitleRow\.show \? \(\s*<SubtitlesRow/.test(tp));
  check('link page: row sits right after WhyStuck', /<WhyStuck model=\{whyModel\} \/> : null\}\n\n\s*\{\/\*[^\n]*\*\/\}\n\s*\{subtitleRow\.show \? \(\s*<SubtitlesRow/.test(dp));
  check('both pages reuse their one SubtitleSheet, passing `initial`', (tp.match(/<SubtitleSheet/g) || []).length === 1 && (dp.match(/<SubtitleSheet/g) || []).length === 1 && /initial=\{subtitleStart\}/.test(tp) && /initial=\{subtitleStart\}/.test(dp));
  check('torrent page: "See all" opens MultiSubtitleSheet in status mode', /<MultiSubtitleSheet[\s\S]*mode="status"/.test(tp));
  const sheet = read('components/subtitles/SubtitleSheet.tsx');
  check('sheet: optional `initial` prop sends editName on open', /initial\?: 'results' \| 'edit-name'/.test(sheet) && /editName: initial === 'edit-name'/.test(sheet));
  check('row copy lives in copy.ts', /ROW_BUTTONS/.test(read('utils/subtitles/copy.ts')) && !/'Not asked yet'/.test(row_));
  check('npm test runs this file', /test-subtitles-row\.js/.test(read('package.json')));

  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log('subtitles row: all passed');
})();
