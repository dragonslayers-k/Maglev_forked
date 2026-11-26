#!/usr/bin/env node
// App self-updater UI/runtime is removed; list-data updates remain separate.
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let failed = 0;
function check(name, cond) {
  if (cond) console.log(`  ok   ${name}`);
  else { failed++; console.error(`  FAIL ${name}`); }
}
const about = read('app/settings/about.tsx');
const up = read('app/settings/updates.tsx');
const layout = read('app/_layout.tsx');
const settings = read('app/(tabs)/settings.tsx');

check('About has no app updater state or controls', !/useHasUpdate|updateCopy\.available|openUpdates|checkNow|installNow|downloadNow/.test(about));
check('About keeps Report a bug', about.includes('오류 신고') && about.includes('reportBug'));
check('About keeps StarTicket and REPO_URL', about.includes('StarTicket') && about.includes('REPO_URL'));
check('About keeps crash log controls', about.includes('copyCrashReport') && about.includes('clearCrashLog'));
check('About version footer is informational, not an update action', /<View style=\{s\.footer\}>/.test(about) && !/Opens Updates/.test(about));

check('Settings exposes list-data updates, not app updates', settings.includes("title: '목록 업데이트'") && /route: 'updates'/.test(settings) && !/title: '업데이트'/.test(settings));
check('Updates page is list-only', up.includes('<SettingsPage title="목록 업데이트">') && up.includes('checkListsNow') && up.includes('useListPrefs'));
check('Updates page has no app version/check/download/install controls', !/useHasUpdate|checkNow\(\{|downloadNow|installNow|UpdateCard|SectionHeader title="App"/.test(up));
check('Root starts list updates independently', layout.includes('startListUpdates') && !layout.includes('startUpdates'));
check('Root registers the protected list-updates route', layout.includes('<Stack.Screen name="settings/updates" />'));

process.exit(failed ? 1 : 0);
