#!/usr/bin/env node
// 0.15 UX: empty Transfers, About integration ticket, Settings "More below" hint, hold-and-drag tabs.
// Pure helpers run from TypeScript source (Node 22.18+); the rest are static wiring checks.
process.removeAllListeners('warning');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let failed = 0;
function check(name, cond) {
  if (cond) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name}`); }
}
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Empty Transfers
const emptyState = read('components/transfers/TeachingEmptyState.tsx');
const copy = read('constants/copy.ts');
const index = read('app/(tabs)/index.tsx');
check('empty title is Korean', /title: '다운로드 중인 항목이 없습니다'/.test(copy));
check('Korean empty body names a link, a .torrent file and search', /링크나 \.torrent 파일을 추가하거나 검색해 보세요\./.test(copy));
check('empty state has a primary "Add a link" button', /label="Add a link"[^>]*icon="link"|icon="link"[^>]*label="Add a link"/.test(emptyState) && /fullWidth/.test(emptyState));
check('empty state has "Open a .torrent file"', /label="Open a \.torrent file"/.test(emptyState));
check('empty state has no "Paste link" or "Copy a link first"', !/Paste link|Copy a link first/.test(emptyState + index.slice(index.indexOf('<TeachingEmptyState'), index.indexOf('<TeachingEmptyState') + 400)));
// A fragment, so it lives in the component: copy.ts strings must be full sentences (test-copy-voice.js).
check('empty state divider says "or find something"', />or find something</.test(emptyState.replace(/\s+/g, ' ').replace(/> or/, '>or').replace(/something </, 'something<')));
check('empty state has Search and Browser tiles', /title="Search"/.test(emptyState) && /title="Browser"/.test(emptyState) && /Save videos from pages/.test(emptyState) && /at once/.test(emptyState));
check('Search tile counts enabled sources', /searchSources=\{searchPrefs\.enabled\.length\}/.test(index));
check('empty state centres tile content', /finder: \{[^}]*alignItems: 'center'/.test(emptyState) && /textAlign: 'center'/.test(emptyState));
check('empty state uses no raw hex', !/#[0-9a-fA-F]{3,8}\b/.test(emptyState));

// 2. Star ticket and About
const ticket = read('components/settings/StarTicket.tsx');
const about = read('app/settings/about.tsx');
check('REPO_URL is the Maglev+ project repo', /export const REPO_URL = 'https:\/\/github\.com\/dragonslayers-k\/Maglev_forked'/.test(ticket));
for (const t of ['MAGLEV+ · INTEGRATION STATUS', '기능 통합·검증 현황', '참고 프로젝트별 반영 범위와 미완성 항목을 확인합니다.', 'INFO', '통합 구성 문서를 엽니다']) {
  check(`ticket copy: ${t}`, ticket.includes(t));
}
check('ticket label for screen readers', ticket.includes('기능 통합 및 검증 현황 확인') && /accessibilityRole="button"/.test(ticket));
check('ticket opens the implementation status doc and is one PressableScale', ticket.includes('FINAL_SOURCE_IMPLEMENTATION_MATRIX_KO.md') && /Linking\.openURL\(/.test(ticket) && /<PressableScale/.test(ticket));
check('ticket title is one line', /numberOfLines=\{1\}\s+adjustsFontSizeToFit/.test(ticket));
check('ticket burst respects reduce motion', /useReduceMotion/.test(ticket) && /if \(!reduceMotion\)/.test(ticket));
check('ticket has no shadow or hex', !/shadow|elevation/.test(ticket) && !/#[0-9a-fA-F]{3,8}\b/.test(ticket));
check('About renders the ticket', /<StarTicket \/>/.test(about));
check('About has no License row', !/License/.test(about));
check('About identifies the Maglev+ integrated community build', about.includes('title="Maglev+ 통합 다운로드 앱"') && about.includes('subtitle="Maglev 기반 · 공개 추출기와 다운로드 엔진을 통합한 커뮤니티 빌드"') && /icon="github"/.test(about) && !/Made with love/.test(about));

// 3. Settings "More below"
const settings = read('app/(tabs)/settings.tsx');
const more = read('components/settings/MoreBelow.tsx');
const hint = require(path.join(root, 'utils/prefs/moreHint.ts'));
check('hint flag key', hint.MORE_HINT_KEY === 'maglev.settings.moreHintSeen.v2');
check('hint flag starts unseen and sticks once marked', hint.getMoreHintSeen() === false && (hint.markMoreHintSeen(), hint.getMoreHintSeen() === true));
check('near the end within 24px', hint.nearEnd(976, 600, 1600) && !hint.nearEnd(900, 600, 1600) && hint.nearEnd(0, 800, 700));
check('pill says "More below" with a chevron-down', /More below/.test(more) && /chevron-down/.test(more));
check('pill bobs 3 cycles and skips with reduce motion', /BOB_CYCLES = 3/.test(more) && /if \(reduceMotion\) return/.test(more));
check('fade ignores touches and uses no gradient package', /pointerEvents="none"/.test(more) && !/linear-gradient/.test(more));
check('settings wires fade, pill and the persisted flag', /<BottomFade/.test(settings) && /<MoreBelowPill/.test(settings) && /markMoreHintSeen/.test(settings));
check('tapping the pill scrolls about 60% of the viewport', /viewport \* 0\.6/.test(settings));

// 4. Hold and drag tabs
const tabs = require(path.join(root, 'components/tabs/tabPrefs.ts'));
const section = read('components/tabs/TabsSection.tsx');
const layout = read('app/_layout.tsx');
check('moveItem moves forward', same(tabs.moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']));
check('moveItem moves back', same(tabs.moveItem(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']));
check('moveItem same slot or out of range is a copy', same(tabs.moveItem(['a', 'b'], 1, 1), ['a', 'b']) && same(tabs.moveItem(['a', 'b'], 0, 5), ['a', 'b']));
check('moveItem does not mutate', (() => { const l = ['a', 'b', 'c']; tabs.moveItem(l, 0, 2); return same(l, ['a', 'b', 'c']); })());
const d = tabs.defaultTabPrefs();
check('reorderTabs drops a row into a slot', same(tabs.reorderTabs(d, d.order, 0, 2).order, ['search', 'feeds', 'index', 'settings', 'browse']));
check('reorderTabs leaves unlisted tabs in place', (() => {
  const listed = d.order;
  return same(tabs.reorderTabs(d, listed, 0, 3).order, ['search', 'feeds', 'settings', 'index', 'browse']);
})());
check('reorderTabs keeps hidden tabs and is a no-op when nothing moves', same(tabs.reorderTabs(d, d.order, 1, 3).hidden, d.hidden) && tabs.reorderTabs(d, d.order, 2, 2) === d);
check('section uses GestureDetector with a long-press pan', /GestureDetector/.test(section) && /usePanGesture/.test(section) && /activateAfterLongPress: LONG_PRESS_MS/.test(section) && /LONG_PRESS_MS = 250/.test(section));
check('section no longer renders MoveButton arrows', !/MoveButton/.test(section) && !/chevron-down/.test(section));
check('section keeps Move up / Move down accessibility actions', /accessibilityActions=/.test(section) && /Move up/.test(section) && /Move down/.test(section) && /onAccessibilityAction/.test(section));
check('section lifts with scale 1.03, lime border and no shadow', /LIFT_SCALE = 1\.03/.test(section) && /colors\.accent/.test(section) && !/shadow|elevation/.test(section));
check('section buzzes on lift and on each slot change via the haptic vocabulary', /haptic\('tap'\)/.test(section) && /haptic\('select'\)/.test(section));
check('section commits through reorderTabs and shows the caption', /reorderTabs\(/.test(section) && /탭을 길게 눌러 드래그하면 순서를 바꿀 수 있습니다\./.test(copy) && /tabsCopy\.reorderHint/.test(section));
check('section keeps locked rows and no longer exposes Assistant', /LOCKED_TABS/.test(section) && !section.includes('assistant'));
check('app root is wrapped in GestureHandlerRootView', /<GestureHandlerRootView/.test(layout));

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nux-015 tests passed');
